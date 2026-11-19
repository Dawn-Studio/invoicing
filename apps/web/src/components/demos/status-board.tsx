import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { Circle, CircleAlert, CircleCheck, CircleDashed, CircleDot } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { money, useCountUp, useTimeline, useVisible, Window } from "./shared";

type Status = "draft" | "open" | "partial" | "overdue" | "paid";

interface Row {
	id: string;
	number: string;
	client: string;
	due: string;
	amount: number;
	status: Status;
}

const BASE: Row[] = [
	{
		id: "57",
		number: "INV-2026-0057",
		client: "Halden Studio AB",
		due: "Due in 9 days",
		amount: 3172,
		status: "open",
	},
	{
		id: "56",
		number: "INV-2026-0056",
		client: "Globex Corporation",
		due: "Due tomorrow",
		amount: 4026,
		status: "open",
	},
	{
		id: "55",
		number: "INV-2026-0055",
		client: "Nordlys AS",
		due: "Due in 2 days",
		amount: 4950,
		status: "open",
	},
	{
		id: "54",
		number: "INV-2026-0054",
		client: "Acme Ventures",
		due: "Paid Nov 2",
		amount: 2400,
		status: "paid",
	},
	{
		id: "53",
		number: "INV-2026-0053",
		client: "Kestrel Labs",
		due: "Paid Oct 28",
		amount: 1450,
		status: "paid",
	},
];

/* What happens, one step at a time, starting from BASE. */
const SCRIPT: ((rows: Row[]) => Row[])[] = [
	(rows) => rows,
	(rows) => set(rows, "55", { status: "paid", due: "Paid today" }),
	(rows) => set(rows, "56", { status: "overdue", due: "1 day overdue" }),
	(rows) => [
		{
			id: "58",
			number: "Draft",
			client: "Nordlys AS",
			due: "Not issued",
			amount: 12140,
			status: "draft",
		},
		...rows,
	],
	(rows) => set(rows, "58", { number: "INV-2026-0058", status: "open", due: "Due in 14 days" }),
	(rows) => set(rows, "57", { status: "partial", due: "€1,500 paid" }),
	(rows) => rows,
];
const DELAYS = [1400, 1800, 1800, 1600, 1600, 1800, 2600];

function set(rows: Row[], id: string, patch: Partial<Row>) {
	return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

const STATUS: Record<Status, { label: string; icon: typeof Circle; className: string }> = {
	draft: { label: "Draft", icon: CircleDashed, className: "text-muted-foreground" },
	open: { label: "Open", icon: Circle, className: "text-brand-ink" },
	partial: { label: "Partly paid", icon: CircleDot, className: "text-warning" },
	overdue: { label: "Overdue", icon: CircleAlert, className: "text-destructive" },
	paid: { label: "Paid", icon: CircleCheck, className: "text-success" },
};

/** The invoice list living its life: payments arrive, one goes overdue, a new one is issued. */
export function StatusBoard() {
	const ref = useRef<HTMLDivElement>(null);
	const visible = useVisible(ref);
	const step = useTimeline(DELAYS, visible);
	const rows = SCRIPT.slice(0, step + 1).reduce((current, change) => change(current), BASE);
	const outstanding = rows
		.filter((row) => row.status !== "paid" && row.status !== "draft")
		.reduce((sum, row) => sum + row.amount - (row.status === "partial" ? 1500 : 0), 0);
	const shown = useCountUp(outstanding, visible, 0.8);
	const overdue = rows.filter((row) => row.status === "overdue").length;

	return (
		<div ref={ref}>
			<Window
				title="Invoices"
				right={
					<span className="text-xs text-muted-foreground tabular-nums">
						Outstanding <span className="text-foreground">{money(shown, "EUR", 0)}</span>
					</span>
				}
			>
				<div className="flex gap-1 border-b px-3 py-2 text-xs">
					{["All", "Open", "Overdue", "Paid"].map((tab, index) => (
						<span
							key={tab}
							className={cn(
								"rounded-md px-2 py-1 text-muted-foreground",
								index === 0 && "bg-accent text-foreground",
							)}
						>
							{tab}
							{tab === "Overdue" && overdue > 0 ? (
								<motion.span
									key={overdue}
									initial={{ scale: 1.6 }}
									animate={{ scale: 1 }}
									className="ml-1 inline-block text-destructive"
								>
									{overdue}
								</motion.span>
							) : null}
						</span>
					))}
				</div>
				<ul className="divide-y">
					<AnimatePresence initial={false}>
						{rows.map((row) => (
							<motion.li
								key={row.id}
								layout
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: "auto" }}
								exit={{ opacity: 0, height: 0 }}
								transition={transitions.smooth}
								className="overflow-hidden"
							>
								<div className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[7rem_8.5rem_minmax(0,1fr)_auto_auto]">
									<StatusLabel status={row.status} />
									<span className="hidden truncate font-mono text-xs sm:block">{row.number}</span>
									<span className="truncate">{row.client}</span>
									<span
										className={cn(
											"hidden text-xs text-muted-foreground sm:block",
											row.status === "overdue" && "text-destructive",
										)}
									>
										{row.due}
									</span>
									<span className="text-right tabular-nums">{money(row.amount, "EUR", 0)}</span>
								</div>
							</motion.li>
						))}
					</AnimatePresence>
				</ul>
			</Window>
		</div>
	);
}

function StatusLabel({ status }: { status: Status }) {
	const { label, icon: Icon, className } = STATUS[status];
	return (
		<span className="relative flex items-center">
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={status}
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.6 }}
					transition={{ type: "spring", stiffness: 500, damping: 22 }}
					className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}
				>
					<span className="relative flex">
						<Icon className="size-3.5" />
						{status === "overdue" || status === "paid" ? (
							<span
								className={cn(
									"absolute inset-0 animate-ping rounded-full opacity-50 [animation-iteration-count:2]",
									status === "overdue" ? "bg-destructive" : "bg-success",
								)}
							/>
						) : null}
					</span>
					{label}
				</motion.span>
			</AnimatePresence>
		</span>
	);
}
