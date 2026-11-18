import { type Client, todayIso } from "@dawnstudio/core";
import { Amount } from "@dawnstudio/ui/components/amount";
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
import { formatAmount, formatIsoDate } from "../../lib/format";
import { useClientStats, useInvoices } from "../../lib/queries";
import { InvoiceRow } from "../invoices/invoice-row";

/** Billed / paid / outstanding per currency, from issued invoices. */
export function ClientOverviewPanel({ client }: { client: Client }) {
	const { data: stats } = useClientStats(client.id);
	if (!stats) return null;
	const hasOverdue = stats.totals.some((t) => t.overdue > 0);

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Overview</PanelTitle>
				{hasOverdue ? (
					<PanelLabel className="text-destructive">Overdue</PanelLabel>
				) : stats.lastIssueDate ? (
					<PanelLabel>Last invoice {formatIsoDate(stats.lastIssueDate)}</PanelLabel>
				) : null}
			</PanelHeader>
			<PanelBody>
				{stats.invoiceCount === 0 && stats.draftCount === 0 ? (
					<p className="text-[0.9375rem] text-muted-foreground">
						No invoices yet. What you bill {client.name} adds up here.
					</p>
				) : (
					<div className="flex flex-col gap-5">
						{stats.totals.map((totals) => (
							<div key={totals.currency} className="flex flex-col gap-4">
								<div className="flex flex-col gap-1">
									<span className="text-sm text-muted-foreground">Outstanding</span>
									<Amount
										value={formatAmount(totals.outstanding, totals.currency)}
										unit={totals.currency}
									/>
								</div>
								<DetailList>
									<DetailRow label="Billed" className="tabular-nums">
										{formatAmount(totals.billed, totals.currency)}
									</DetailRow>
									<DetailRow label="Paid" className="tabular-nums">
										{formatAmount(totals.paid, totals.currency)}
									</DetailRow>
									{totals.overdue > 0 ? (
										<DetailRow label="Overdue" className="text-destructive tabular-nums">
											{formatAmount(totals.overdue, totals.currency)}
										</DetailRow>
									) : null}
								</DetailList>
							</div>
						))}
						<DetailList className="border-t pt-4">
							<DetailRow label="Invoices">
								{stats.invoiceCount}
								{stats.draftCount > 0 ? (
									<span className="text-muted-foreground">
										{" "}
										+ {stats.draftCount} {stats.draftCount === 1 ? "draft" : "drafts"}
									</span>
								) : null}
							</DetailRow>
						</DetailList>
					</div>
				)}
			</PanelBody>
		</Panel>
	);
}

/** Every invoice for this client, newest first. Hidden until there is one. */
export function ClientInvoicesPanel({ clientId }: { clientId: string }) {
	const { data: invoices = [] } = useInvoices({ clientId });
	if (invoices.length === 0) return null;
	const today = todayIso();

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Invoices</PanelTitle>
				<PanelLabel>{invoices.length}</PanelLabel>
			</PanelHeader>
			<PanelBody>
				<RowList className="my-0 [&>li]:py-0">
					{invoices.map((invoice) => (
						<InvoiceRow key={invoice.id} invoice={invoice} today={today} showClient={false} />
					))}
				</RowList>
			</PanelBody>
		</Panel>
	);
}
