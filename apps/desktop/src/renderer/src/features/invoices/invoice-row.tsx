import type { InvoiceStatus, InvoiceSummary } from "@dawnstudio/core";
import { UnitTag } from "@dawnstudio/ui/components/amount";
import { Badge } from "@dawnstudio/ui/components/badge";
import { cn } from "@dawnstudio/ui/lib/utils";
import { Link } from "react-router";
import { formatAmount, formatIsoDate, joinParts } from "../../lib/format";

/** Stored status plus "overdue" (from the due date) and "partial" (some money received). */
export type DisplayStatus = InvoiceStatus | "overdue" | "partial";

const statusLabels: Record<DisplayStatus, string> = {
	draft: "Draft",
	issued: "Open",
	overdue: "Overdue",
	partial: "Partly paid",
	paid: "Paid",
	void: "Void",
};

export function displayStatus(
	invoice: Pick<InvoiceSummary, "status" | "dueDate" | "amountPaid">,
	today: string,
): DisplayStatus {
	if (invoice.status !== "issued") return invoice.status;
	if (invoice.dueDate < today) return "overdue";
	return invoice.amountPaid > 0 ? "partial" : "issued";
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
	return (
		<Badge
			variant={status === "overdue" ? "destructive" : status === "paid" ? "secondary" : "outline"}
		>
			{statusLabels[status]}
		</Badge>
	);
}

/** One invoice in a list: number and status, client and dates, amount. Opens the invoice. */
export function InvoiceRow({
	invoice,
	today,
	showClient = true,
}: {
	invoice: InvoiceSummary;
	today: string;
	showClient?: boolean;
}) {
	const status = displayStatus(invoice, today);
	return (
		<li>
			<Link
				to={`/invoices/${invoice.id}`}
				className="-mx-3 flex items-center gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-accent/60"
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 text-[0.9375rem]">
						<span className={invoice.number ? "font-mono" : "text-muted-foreground"}>
							{invoice.number ?? "Not issued yet"}
						</span>
						<StatusBadge status={status} />
					</div>
					<div className="truncate text-sm text-muted-foreground">
						{joinParts(
							showClient ? (invoice.clientName ?? "No client") : null,
							formatIsoDate(invoice.issueDate),
							`due ${formatIsoDate(invoice.dueDate)}`,
						)}
					</div>
				</div>
				<span
					className={cn("tabular-nums", status === "void" && "text-muted-foreground line-through")}
				>
					{formatAmount(invoice.total, invoice.currency)}
				</span>
				<UnitTag>{invoice.currency}</UnitTag>
			</Link>
		</li>
	);
}
