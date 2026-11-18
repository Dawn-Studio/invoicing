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
import { cn } from "@dawnstudio/ui/lib/utils";
import { X } from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { Page, PageSection } from "../../components/page";
import { formatAmount, formatIsoDate, formatTimestamp, joinParts } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import {
	useInvoice,
	useLogoFile,
	usePayments,
	useRemovePayment,
	useRpcQuery,
} from "../../lib/queries";
import { DraftEditor } from "./draft-editor";
import { InvoicePreview } from "./invoice-preview";
import { displayStatus, StatusBadge } from "./invoice-row";
import { IssuedActions } from "./issued-actions";

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
	const { data: logo } = useLogoFile(invoice.snapshot?.issuer.logoFile);
	const { data: events = [] } = useRpcQuery("invoices.events", { id: invoice.id });
	const snapshot = invoice.snapshot;
	const today = todayIso();
	const status = displayStatus(invoice, today);
	const balance = invoice.total - invoice.amountPaid;
	const money = (minor: number) => formatAmount(minor, invoice.currency);

	return (
		<Page
			title={<span className="font-mono">{invoice.number}</span>}
			back={{ to: "/invoices", label: "Invoices" }}
			className="@container max-w-[1440px]"
			actions={<IssuedActions invoice={invoice} />}
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
								<div className="flex flex-col gap-1">
									<span className="text-sm text-muted-foreground">
										{invoice.status === "issued" ? "Balance due" : "Total"}
									</span>
									<Amount
										value={money(invoice.status === "issued" ? balance : invoice.total)}
										unit={invoice.currency}
										className={cn(status === "void" && "text-muted-foreground line-through")}
									/>
								</div>
								<DetailList>
									{invoice.amountPaid > 0 && invoice.status === "issued" ? (
										<>
											<DetailRow label="Total" className="tabular-nums">
												{money(invoice.total)}
											</DetailRow>
											<DetailRow label="Paid so far" className="tabular-nums">
												{money(invoice.amountPaid)}
											</DetailRow>
										</>
									) : null}
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
								</DetailList>
							</PanelBody>
						</Panel>
					</PageSection>
					<PageSection>
						<PaymentsPanel invoice={invoice} />
					</PageSection>
					<PageSection>
						<ActivityPanel events={events} currency={invoice.currency} />
					</PageSection>
				</div>
				<PageSection className="@3xl:sticky @3xl:top-14">
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
	if (invoice.status === "paid")
		return invoice.paidAt ? `Paid ${formatTimestamp(invoice.paidAt)}` : "Paid";
	if (invoice.status === "void") return "Void";
	const days = Math.round((Date.parse(invoice.dueDate) - Date.parse(today)) / 86_400_000);
	if (days === 0) return "Due today";
	if (days > 0) return `Due in ${days} ${days === 1 ? "day" : "days"}`;
	return `${-days} ${days === -1 ? "day" : "days"} overdue`;
}

/** Money received; hidden on void invoices with nothing recorded. */
function PaymentsPanel({ invoice }: { invoice: Invoice }) {
	const { data: payments = [] } = usePayments(invoice.id);
	const remove = useRemovePayment();
	if (invoice.status === "void" && payments.length === 0) return null;

	const onRemove = async (id: string) => {
		try {
			await remove.mutateAsync({ id });
			toast.success("Payment removed");
		} catch (error) {
			showSaveError(error);
		}
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Payments</PanelTitle>
				{payments.length > 0 ? <PanelLabel>{payments.length}</PanelLabel> : null}
			</PanelHeader>
			<PanelBody>
				{payments.length === 0 ? (
					<p className="text-[0.9375rem] text-muted-foreground">
						Nothing received yet. Record a payment when the money arrives; part payments leave the
						rest open.
					</p>
				) : (
					<RowList className="[&>li]:py-3.5">
						{payments.map((payment) => (
							<li key={payment.id} className="flex items-center gap-4 text-[0.9375rem]">
								<div className="min-w-0 flex-1">
									<div>{formatIsoDate(payment.date)}</div>
									{payment.method || payment.note ? (
										<div className="truncate text-sm text-muted-foreground">
											{joinParts(payment.method, payment.note)}
										</div>
									) : null}
								</div>
								<span className="tabular-nums">
									{formatAmount(payment.amount, invoice.currency)}
								</span>
								{invoice.status !== "void" ? (
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label="Remove payment"
										className="text-muted-foreground"
										disabled={remove.isPending}
										onClick={() => onRemove(payment.id)}
									>
										<X />
									</Button>
								) : null}
							</li>
						))}
					</RowList>
				)}
			</PanelBody>
		</Panel>
	);
}

type EventPayload = Record<string, unknown>;

function eventText(event: InvoiceEvent, currency: string): string {
	const p: EventPayload = event.payload;
	const amount =
		typeof p.amount === "number" ? `${formatAmount(p.amount, currency)} ${currency}` : "";
	switch (event.type) {
		case "created":
			return "Draft created";
		case "issued":
			return `Issued as ${String(p.number ?? "")}`.trim();
		case "payment":
			return `Payment of ${amount} received`;
		case "paymentRemoved":
			return `Payment of ${amount} removed`;
		case "paid":
			return "Paid in full";
		case "unpaid":
			return "Reopened";
		case "exported":
			return p.fileName ? `Exported ${String(p.fileName)}` : "PDF exported";
		case "sent":
			return p.reminder
				? `Reminder sent to ${String(p.to ?? "")}`
				: `Sent to ${String(p.to ?? "")}`;
		case "voided":
			return p.reason ? `Voided: ${String(p.reason)}` : "Voided";
	}
}

function ActivityPanel({ events, currency }: { events: InvoiceEvent[]; currency: string }) {
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
							<span>{eventText(event, currency)}</span>
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
