import { formatMoney, lineAmount, parseQuantity, toMinor } from "@dawnstudio/core";
import {
	Confirmation,
	ConfirmationAccepted,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRejected,
	ConfirmationRequest,
	ConfirmationTitle,
} from "@dawnstudio/ui/components/ai-elements/confirmation";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@dawnstudio/ui/components/ai-elements/tool";
import { Button } from "@dawnstudio/ui/components/button";
import type { ToolUIPart } from "ai";
import { ArrowUpRight, Check, CircleSlash } from "lucide-react";
import { useNavigate } from "react-router";
import { useClient } from "../../lib/queries";

/** What each lookup is called in the conversation. */
const LOOKUPS: Record<string, string> = {
	getBusinessProfile: "Read your business details",
	searchClients: "Searched clients",
	getClient: "Looked up a client",
	searchInvoices: "Searched invoices",
	getInvoice: "Opened an invoice",
	searchCatalog: "Searched saved items",
	listTaxRates: "Checked tax rates",
	getReport: "Ran a report",
};

const CHANGES: Record<string, { title: string; done: string }> = {
	createClient: { title: "Add this client?", done: "Client added" },
	createDraftInvoice: { title: "Create this draft invoice?", done: "Draft created" },
	updateDraftInvoice: { title: "Update the draft like this?", done: "Draft updated" },
	addCatalogItem: { title: "Save this item?", done: "Item saved" },
};

interface Props {
	part: ToolUIPart;
	onApproval: (response: { id: string; approved: boolean }) => void;
}

/** A tool call in a reply: lookups fold into one line; changes ask for approval first. */
export function ToolPart({ part, onApproval }: Props) {
	const name = part.type.slice("tool-".length);
	const change = CHANGES[name];
	if (!change) {
		const label = LOOKUPS[name] ?? name;
		const running = part.state === "input-streaming" || part.state === "input-available";
		return (
			<Tool className="mb-0 border-border/70">
				<ToolHeader
					type={part.type}
					state={part.state}
					title={running ? `${label}…` : label}
					className="py-2"
				/>
				<ToolContent>
					<ToolInput input={part.input} />
					<ToolOutput output={part.output} errorText={part.errorText} />
				</ToolContent>
			</Tool>
		);
	}

	const input = (part.input ?? {}) as Record<string, unknown>;
	const output =
		part.state === "output-available" ? (part.output as Record<string, unknown>) : null;
	return (
		<Confirmation
			approval={part.approval}
			state={part.state}
			className="gap-3 border-border/70 bg-card"
		>
			<ConfirmationTitle className="font-medium text-foreground">
				<ConfirmationRequest>{change.title}</ConfirmationRequest>
				<ConfirmationAccepted>
					<span className="inline-flex items-center gap-1.5">
						<Check className="size-4 text-success" />
						{output ? change.done : "Approved"}
					</span>
				</ConfirmationAccepted>
				<ConfirmationRejected>
					<span className="inline-flex items-center gap-1.5 text-muted-foreground">
						<CircleSlash className="size-4" />
						Not applied
					</span>
				</ConfirmationRejected>
			</ConfirmationTitle>
			<ChangePreview name={name} input={input} />
			{part.state === "output-error" ? (
				<p className="text-sm text-destructive">{part.errorText}</p>
			) : null}
			{output ? <ChangeResult name={name} output={output} /> : null}
			<ConfirmationActions>
				<ConfirmationAction
					variant="outline"
					onClick={() => part.approval && onApproval({ id: part.approval.id, approved: false })}
				>
					Don't
				</ConfirmationAction>
				<ConfirmationAction
					onClick={() => part.approval && onApproval({ id: part.approval.id, approved: true })}
				>
					Approve
				</ConfirmationAction>
			</ConfirmationActions>
		</Confirmation>
	);
}

interface LineInput {
	description?: string;
	quantity?: string;
	unitPrice?: string;
	unit?: string;
}

/** A readable summary of exactly what the change will write. */
function ChangePreview({ name, input }: { name: string; input: Record<string, unknown> }) {
	if (name === "createClient") {
		const address = (input.address ?? {}) as Record<string, string | undefined>;
		const place = [address.city, address.country].filter(Boolean).join(", ");
		return (
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				<Row label="Name" value={input.name} />
				<Row label="Contact" value={input.contactName} />
				<Row label="Email" value={input.email} />
				<Row label="Tax ID" value={input.taxId} />
				<Row label="Currency" value={input.currency} />
				<Row
					label="Address"
					value={[address.line1, place].filter(Boolean).join(" · ") || undefined}
				/>
			</dl>
		);
	}
	if (name === "addCatalogItem") {
		return (
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				<Row label="Item" value={input.description} />
				<Row label="Price" value={priceText(input.unitPrice, input.currency, input.unit)} />
			</dl>
		);
	}
	return <DraftPreview input={input} />;
}

function DraftPreview({ input }: { input: Record<string, unknown> }) {
	const clientId = typeof input.clientId === "string" ? input.clientId : undefined;
	const { data: client } = useClient(clientId);
	const currency = typeof input.currency === "string" ? input.currency : (client?.currency ?? null);
	const items = Array.isArray(input.items) ? (input.items as LineInput[]) : null;
	const total = items && currency ? safeTotal(items, currency) : null;
	return (
		<div className="flex flex-col gap-2 text-sm">
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
				<Row label="Client" value={client?.name ?? (clientId ? "…" : undefined)} />
				<Row label="Currency" value={currency ?? undefined} />
				<Row label="Issue date" value={input.issueDate} />
				<Row label="Due" value={input.dueDate} />
				<Row label="Notes" value={input.notes} />
			</dl>
			{items ? (
				<div className="overflow-hidden rounded-md border">
					<table className="w-full text-[0.8125rem]">
						<tbody className="divide-y">
							{items.map((line, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: lines have no id until saved
								<tr key={index}>
									<td className="px-2.5 py-1.5">{line.description}</td>
									<td className="px-2.5 py-1.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
										{line.quantity}
										{line.unit ? ` ${line.unit}` : ""} × {line.unitPrice}
									</td>
								</tr>
							))}
						</tbody>
						{total ? (
							<tfoot className="border-t bg-muted/40">
								<tr>
									<td className="px-2.5 py-1.5 text-muted-foreground">Before tax</td>
									<td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{total}</td>
								</tr>
							</tfoot>
						) : null}
					</table>
				</div>
			) : null}
		</div>
	);
}

function ChangeResult({ name, output }: { name: string; output: Record<string, unknown> }) {
	const navigate = useNavigate();
	const to =
		typeof output.invoiceId === "string"
			? `/invoices/${output.invoiceId}`
			: name === "createClient" && typeof output.id === "string"
				? `/clients/${output.id}`
				: name === "addCatalogItem"
					? "/items"
					: null;
	if (!to) return null;
	return (
		<Button size="sm" variant="outline" className="self-start" onClick={() => navigate(to)}>
			{name === "createClient"
				? "Open client"
				: name === "addCatalogItem"
					? "Open items"
					: "Open draft"}
			<ArrowUpRight />
		</Button>
	);
}

function Row({ label, value }: { label: string; value: unknown }) {
	if (value === undefined || value === null || value === "") return null;
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{String(value)}</dd>
		</>
	);
}

function priceText(price: unknown, currency: unknown, unit: unknown) {
	if (typeof price !== "string" || typeof currency !== "string") return undefined;
	try {
		const text = formatMoney(toMinor(price, currency), currency);
		return typeof unit === "string" && unit ? `${text} / ${unit}` : text;
	} catch {
		return `${price} ${currency}`;
	}
}

/** The lines' total before tax, or null while the model is still writing them. */
function safeTotal(items: LineInput[], currency: string) {
	try {
		const sum = items.reduce(
			(total, line) =>
				total +
				lineAmount({
					quantity: parseQuantity(line.quantity ?? "0"),
					unitPrice: toMinor(line.unitPrice ?? "0", currency),
				}),
			0,
		);
		return formatMoney(sum, currency);
	} catch {
		return null;
	}
}
