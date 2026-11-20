import { formatMoney, lineAmount, parseQuantity, toMinor } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@dawnstudio/ui/components/trace";
import type { ToolUIPart } from "ai";
import {
	ArrowUpRight,
	Building2,
	ChartColumn,
	Check,
	CircleSlash,
	CircleX,
	FilePen,
	FilePlus2,
	FileText,
	type LucideIcon,
	Package,
	PackagePlus,
	Percent,
	Search,
	User,
	UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useClient } from "../../lib/queries";

type Input = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const count = (output: unknown) => (Array.isArray(output) ? output.length : null);
const found = (output: unknown) => {
	const n = count(output);
	return n === null ? null : n === 0 ? "nothing found" : `${n} found`;
};

/** How each lookup reads in the log, from what it was asked and what came back. */
const LOOKUPS: Record<
	string,
	{ icon: LucideIcon; title: (input: Input) => string; detail?: (output: unknown) => string | null }
> = {
	getBusinessProfile: { icon: Building2, title: () => "Read your business details" },
	searchClients: {
		icon: Search,
		title: (input) =>
			str(input.query)
				? `Searched clients for “${str(input.query)}”`
				: "Looked through your clients",
		detail: found,
	},
	getClient: {
		icon: User,
		title: () => "Opened a client",
		detail: (output) => str((output as Input | null)?.name),
	},
	searchInvoices: {
		icon: Search,
		title: (input) => {
			const statuses = Array.isArray(input.status) ? input.status.join(", ") : null;
			const query = str(input.query);
			return `Searched ${statuses ? `${statuses} ` : ""}invoices${query ? ` for “${query}”` : ""}`;
		},
		detail: found,
	},
	getInvoice: {
		icon: FileText,
		title: () => "Opened an invoice",
		detail: (output) => {
			const invoice = output as Input | null;
			return [str(invoice?.number) ?? "Draft", str(invoice?.total)].filter(Boolean).join(" · ");
		},
	},
	searchCatalog: {
		icon: Package,
		title: (input) =>
			str(input.query)
				? `Searched saved items for “${str(input.query)}”`
				: "Looked through saved items",
		detail: found,
	},
	listTaxRates: {
		icon: Percent,
		title: () => "Checked your tax rates",
		detail: (output) => {
			const n = count(output);
			return n === null ? null : `${n} ${n === 1 ? "rate" : "rates"}`;
		},
	},
	getReport: {
		icon: ChartColumn,
		title: (input) => `Ran a report for ${str(input.from) ?? "?"} – ${str(input.to) ?? "?"}`,
	},
};

const CHANGES: Record<
	string,
	{
		icon: LucideIcon;
		ask: string;
		running: string;
		done: (input: Input, output: Input) => string;
		denied: string;
	}
> = {
	createClient: {
		icon: UserPlus,
		ask: "Add this client?",
		running: "Adding the client",
		done: (input) => `Added ${str(input.name) ?? "a client"}`,
		denied: "Didn't add the client",
	},
	createDraftInvoice: {
		icon: FilePlus2,
		ask: "Create this draft invoice?",
		running: "Creating the draft",
		done: (_input, output) =>
			`Created a draft${str(output.client) ? ` for ${str(output.client)}` : ""}`,
		denied: "Didn't create the draft",
	},
	updateDraftInvoice: {
		icon: FilePen,
		ask: "Change the draft like this?",
		running: "Updating the draft",
		done: () => "Updated the draft",
		denied: "Left the draft as it was",
	},
	addCatalogItem: {
		icon: PackagePlus,
		ask: "Save this item?",
		running: "Saving the item",
		done: (input) => `Saved “${str(input.description) ?? "item"}”`,
		denied: "Didn't save the item",
	},
};

interface Props {
	part: ToolUIPart;
	onApproval: (response: { id: string; approved: boolean }) => void;
}

/**
 * A step the assistant took, as one quiet line in a log (shadcn's trace): what it looked up
 * and what it found, or what it changed. A change waiting for approval shows as a card with
 * exactly what will be written.
 */
export function ToolPart({ part, onApproval }: Props) {
	const name = part.type.slice("tool-".length);
	const input = (part.input ?? {}) as Input;
	const running = part.state === "input-streaming" || part.state === "input-available";
	const change = CHANGES[name];

	if (!change) {
		const lookup = LOOKUPS[name] ?? { icon: Search, title: () => name };
		const Icon = part.state === "output-error" ? CircleX : lookup.icon;
		const detail = part.state === "output-available" ? lookup.detail?.(part.output) : null;
		return (
			<Trace>
				<TraceCollapsible>
					<TraceCollapsibleTrigger disabled={running}>
						<TraceLine
							status={part.state === "output-error" ? "error" : running ? "running" : "done"}
						>
							<TraceIcon>
								<Icon />
							</TraceIcon>
							<TraceTitle>{lookup.title(input)}</TraceTitle>
							{detail ? <TraceDescription>{detail}</TraceDescription> : null}
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Details
							input={input}
							output={part.state === "output-available" ? part.output : undefined}
							error={part.errorText}
						/>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
		);
	}

	if (part.state === "approval-requested") {
		const Icon = change.icon;
		return (
			<div className="flex flex-col gap-3 rounded-xl border bg-card/80 p-4 shadow-xs">
				<div className="flex items-center gap-2 text-sm font-medium">
					<Icon className="size-4 text-brand-ink" />
					{change.ask}
				</div>
				<ChangePreview name={name} input={input} />
				<div className="flex justify-end gap-2">
					<Button
						size="sm"
						variant="ghost"
						onClick={() => part.approval && onApproval({ id: part.approval.id, approved: false })}
					>
						Don't
					</Button>
					<Button
						size="sm"
						onClick={() => part.approval && onApproval({ id: part.approval.id, approved: true })}
					>
						Approve
					</Button>
				</div>
			</div>
		);
	}

	const denied =
		part.state === "output-denied" ||
		(part.state === "approval-responded" && part.approval?.approved === false);
	const output = part.state === "output-available" ? ((part.output ?? {}) as Input) : null;
	const failed = part.state === "output-error";
	const status = failed ? "error" : output || denied ? "done" : "running";
	const Icon = failed ? CircleX : denied ? CircleSlash : output ? Check : change.icon;
	const title = failed
		? `${change.running} failed`
		: denied
			? change.denied
			: output
				? change.done(input, output)
				: `${change.running}…`;

	return (
		<Trace>
			<div className="flex min-w-0 items-start gap-2">
				<TraceCollapsible className="w-auto min-w-0">
					<TraceCollapsibleTrigger>
						<TraceLine status={status} className={output ? "text-foreground" : undefined}>
							<TraceIcon className={output ? "text-success" : undefined}>
								<Icon />
							</TraceIcon>
							<TraceTitle>{title}</TraceTitle>
							{output && str(output.total) ? (
								<TraceDescription>{str(output.total)}</TraceDescription>
							) : null}
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<ChangePreview name={name} input={input} />
						{failed ? <p className="mt-2 text-destructive">{part.errorText}</p> : null}
					</TraceCollapsibleContent>
				</TraceCollapsible>
				{output ? <OpenResult name={name} output={output} /> : null}
			</div>
		</Trace>
	);
}

/** What a lookup was asked and a glance at what came back, in the trace's monospace box. */
function Details({ input, output, error }: { input: Input; output: unknown; error?: string }) {
	const asked = Object.entries(input).filter(
		([, value]) => value !== undefined && value !== "" && value !== null,
	);
	const rows = Array.isArray(output) ? (output as Input[]) : null;
	const label = (row: Input) =>
		[
			str(row.name) ?? str(row.number) ?? str(row.description),
			str(row.total) ?? str(row.unitPrice) ?? str(row.rate) ?? str(row.email),
		]
			.filter(Boolean)
			.join("  ·  ");
	return (
		<div className="flex flex-col gap-2 rounded-md bg-muted/60 p-3 font-mono text-xs">
			{asked.length ? (
				<p className="text-muted-foreground">
					{asked
						.map(
							([key, value]) =>
								`${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
						)
						.join("   ")}
				</p>
			) : null}
			{error ? <p className="text-destructive">{error}</p> : null}
			{rows ? (
				rows.length ? (
					<ol className="flex flex-col gap-0.5 text-foreground">
						{rows.slice(0, 8).map((row, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a read-only snapshot of results
							<li key={index} className="truncate">
								{label(row) || JSON.stringify(row)}
							</li>
						))}
						{rows.length > 8 ? (
							<li className="text-muted-foreground">and {rows.length - 8} more</li>
						) : null}
					</ol>
				) : (
					<p className="text-muted-foreground">Nothing found.</p>
				)
			) : output !== undefined ? (
				<pre className="max-h-48 overflow-auto whitespace-pre-wrap text-foreground">
					{JSON.stringify(output, null, 2)}
				</pre>
			) : null}
		</div>
	);
}

function OpenResult({ name, output }: { name: string; output: Input }) {
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
		<Button size="xs" variant="outline" className="shrink-0" onClick={() => navigate(to)}>
			Open
			<ArrowUpRight />
		</Button>
	);
}

interface LineInput {
	description?: string;
	quantity?: string;
	unitPrice?: string;
	unit?: string;
}

/** A readable summary of exactly what the change writes. */
function ChangePreview({ name, input }: { name: string; input: Input }) {
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

function DraftPreview({ input }: { input: Input }) {
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
				<div className="overflow-hidden rounded-lg border">
					<table className="w-full text-[0.8125rem]">
						<tbody className="divide-y">
							{items.map((line, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: lines have no id until saved
								<tr key={index}>
									<td className="px-2.5 py-1.5 text-foreground">{line.description}</td>
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
									<td className="px-2.5 py-1.5 text-right font-medium text-foreground tabular-nums">
										{total}
									</td>
								</tr>
							</tfoot>
						) : null}
					</table>
				</div>
			) : null}
		</div>
	);
}

function Row({ label, value }: { label: string; value: unknown }) {
	if (value === undefined || value === null || value === "") return null;
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words text-foreground">{String(value)}</dd>
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
