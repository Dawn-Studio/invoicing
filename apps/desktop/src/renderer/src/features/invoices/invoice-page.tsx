import { type Invoice, type InvoiceEvent, todayIso } from "@dawnstudio/core";
import { Alert, AlertDescription, AlertTitle } from "@dawnstudio/ui/components/alert";
import { Amount } from "@dawnstudio/ui/components/amount";
import { Button } from "@dawnstudio/ui/components/button";
import {
	DetailList,
	DetailRow,
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
	RowList,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { cn } from "@dawnstudio/ui/lib/utils";
import { Copy } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Page, PageSection } from "../../components/page";
import { formatAmount, formatIsoDate, formatTimestamp } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import { useDuplicateInvoice, useInvoice, useLogoFile, useRpcQuery } from "../../lib/queries";
import { DraftEditor } from "./draft-editor";
import { InvoicePreview } from "./invoice-preview";
import { displayStatus, StatusBadge } from "./invoice-row";

/** `/invoices/:id`: the editor for drafts, the locked invoice otherwise. */
export function InvoicePage() {
	const { id } = useParams();
	const { data: invoice, isPending, error } = useInvoice(id);

	if (isPending) {
		return (
			<Page title="Invoice" back={{ to: "/invoices", label: "Invoices" }}>
				{null}
			</Page>
		);
	}
	if (error || !invoice) {
		return (
			<Page title="Invoice" back={{ to: "/invoices", label: "Invoices" }}>
				<PageSection>
					<Alert>
						<AlertTitle>Invoice not found</AlertTitle>
						<AlertDescription>It may have been deleted.</AlertDescription>
					</Alert>
				</PageSection>
			</Page>
		);
	}
	// Remount per invoice so the editor starts from that draft's saved state.
	return invoice.status === "draft" ? (
		<DraftEditor key={invoice.id} invoice={invoice} />
	) : (
		<IssuedInvoice invoice={invoice} />
	);
}

function IssuedInvoice({ invoice }: { invoice: Invoice }) {
	const navigate = useNavigate();
	const duplicate = useDuplicateInvoice();
	const { data: logo } = useLogoFile(invoice.snapshot?.issuer.logoFile);
	const { data: events = [] } = useRpcQuery("invoices.events", { id: invoice.id });
	const snapshot = invoice.snapshot;
	const today = todayIso();
	const status = displayStatus(invoice, today);

	const onDuplicate = async () => {
		try {
			const copy = await duplicate.mutateAsync({ id: invoice.id });
			navigate(`/invoices/${copy.id}`);
			toast.success("Duplicated as a new draft");
		} catch (error) {
			showSaveError(error);
		}
	};

	return (
		<Page
			title={<span className="font-mono">{invoice.number}</span>}
			back={{ to: "/invoices", label: "Invoices" }}
			className="@container max-w-[1440px]"
			actions={
				<Button size="sm" variant="outline" onClick={onDuplicate} disabled={duplicate.isPending}>
					{duplicate.isPending ? <Spinner /> : <Copy />}
					Duplicate
				</Button>
			}
		>
			<div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
				<div className="flex min-w-0 flex-col gap-3">
					<PageSection>
						<Panel>
							<PanelHeader>
								<div className="flex items-center gap-2">
									<PanelTitle>Invoice</PanelTitle>
									<StatusBadge status={status} />
								</div>
								<PanelLabel className={cn(status === "overdue" && "text-destructive")}>
									{dueLabel(invoice, today)}
								</PanelLabel>
							</PanelHeader>
							<PanelBody className="flex flex-col gap-5">
								<Amount
									value={formatAmount(invoice.total, invoice.currency)}
									unit={invoice.currency}
									className={cn(status === "void" && "text-muted-foreground line-through")}
								/>
								<DetailList>
									<DetailRow label="Client">
										{invoice.clientId ? (
											<Link
												to={`/clients/${invoice.clientId}`}
												className="underline-offset-4 hover:underline"
											>
												{snapshot?.client.name}
											</Link>
										) : (
											snapshot?.client.name
										)}
									</DetailRow>
									<DetailRow label="Issued">{formatIsoDate(invoice.issueDate)}</DetailRow>
									<DetailRow label="Due">{formatIsoDate(invoice.dueDate)}</DetailRow>
									{snapshot?.paymentAccount ? (
										<DetailRow label="Paid to">{snapshot.paymentAccount.label}</DetailRow>
									) : null}
									{invoice.paidAt ? (
										<DetailRow label="Paid on">{formatTimestamp(invoice.paidAt)}</DetailRow>
									) : null}
								</DetailList>
							</PanelBody>
						</Panel>
					</PageSection>
					<PageSection>
						<ActivityPanel events={events} />
					</PageSection>
				</div>
				<PageSection className="@3xl:sticky @3xl:top-2">
					{snapshot ? (
						<InvoicePreview
							invoice={snapshot}
							logoSrc={logo}
							stamp={invoice.status === "void" ? "Void" : null}
						/>
					) : null}
				</PageSection>
			</div>
		</Page>
	);
}

function dueLabel(invoice: Invoice, today: string): string {
	if (invoice.status === "paid") return "Paid";
	if (invoice.status === "void") return "Void";
	const days = Math.round((Date.parse(invoice.dueDate) - Date.parse(today)) / 86_400_000);
	if (days === 0) return "Due today";
	if (days > 0) return `Due in ${days} ${days === 1 ? "day" : "days"}`;
	return `${-days} ${days === -1 ? "day" : "days"} overdue`;
}

const eventText: Record<InvoiceEvent["type"], (payload: Record<string, unknown>) => string> = {
	created: () => "Draft created",
	issued: (payload) => `Issued as ${String(payload.number ?? "")}`.trim(),
	paid: () => "Marked as paid",
	unpaid: () => "Marked as unpaid",
	voided: (payload) => (payload.reason ? `Voided: ${String(payload.reason)}` : "Voided"),
};

function ActivityPanel({ events }: { events: InvoiceEvent[] }) {
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Activity</PanelTitle>
			</PanelHeader>
			<PanelBody>
				<RowList className="[&>li]:py-3.5">
					{[...events].reverse().map((event) => (
						<li
							key={event.id}
							className="flex items-baseline justify-between gap-4 text-[0.9375rem]"
						>
							<span>{eventText[event.type](event.payload)}</span>
							<span className="shrink-0 text-sm text-muted-foreground">
								{formatTimestamp(event.createdAt)}
							</span>
						</li>
					))}
				</RowList>
			</PanelBody>
		</Panel>
	);
}
