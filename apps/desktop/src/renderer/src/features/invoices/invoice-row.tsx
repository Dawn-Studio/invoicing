import type { InvoiceStatus, InvoiceSummary } from "@dawnstudio/core";
import { UnitTag } from "@dawnstudio/ui/components/amount";
import { cn } from "@dawnstudio/ui/lib/utils";
import {
	Circle,
	CircleAlert,
	CircleCheck,
	CircleDashed,
	CircleDot,
	CircleSlash,
	type LucideIcon,
} from "lucide-react";
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

const statusIcons: Record<DisplayStatus, { icon: LucideIcon; className: string }> = {
	draft: { icon: CircleDashed, className: "text-muted-foreground" },
	issued: { icon: Circle, className: "text-brand-ink" },
	partial: { icon: CircleDot, className: "text-warning" },
	overdue: { icon: CircleAlert, className: "text-destructive" },
	paid: { icon: CircleCheck, className: "text-success" },
	void: { icon: CircleSlash, className: "text-muted-foreground" },
};

/** Linear-style status: a coloured circle icon and the name. */
export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
	const { icon: Icon, className: tone } = statusIcons[status];
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground",
				status === "overdue" && "text-destructive",
				className,
			)}
		>
			<Icon className={cn("size-3.5", tone)} />
			{statusLabels[status]}
		</span>
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
