import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { Check, CircleDashed, FileCheck2, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { money, useCountUp, useTimeline, useVisible, Window } from "./shared";

const LINES = [
	{ description: "Brand identity", qty: "1", rate: 4200 },
	{ description: "Marketing website", qty: "1", rate: 6800 },
	{ description: "Design support", qty: "12 h", rate: 95, total: 1140 },
];

/* Steps: blank, three lines typed in, issued, paid, hold. Delays are how long each step lasts. */
const DELAYS = [900, 1300, 1300, 1500, 1600, 2600, 1200];

type Status = "draft" | "issued" | "paid";

/** The hero's invoice: lines type themselves in, the total counts up, then it's issued and paid. */
export function InvoiceDemo() {
	const ref = useRef<HTMLDivElement>(null);
	const visible = useVisible(ref);
	const step = useTimeline(DELAYS, visible);
	const lines = Math.min(step, 3);
	const status: Status = step >= 5 ? "paid" : step >= 4 ? "issued" : "draft";
	const target = LINES.slice(0, lines).reduce((sum, line) => sum + (line.total ?? line.rate), 0);
	const total = useCountUp(target, true, 0.9);

	return (
		<div ref={ref} className="relative">
			<Window
				title={status === "draft" ? "Draft · INV-2026-0058" : "INV-2026-0058"}
				right={<StatusPill status={status} />}
				bodyClassName="bg-background/40 p-4 sm:p-6"
			>
				{/* The printed page, like the app's live preview. */}
				<div className="relative rounded-lg bg-white p-5 text-[#141710] shadow-xl sm:p-7">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-center gap-2">
							<span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
								D
							</span>
							<span className="text-sm font-semibold">Dawn Studio</span>
						</div>
						<div className="text-right">
							<p className="text-[0.625rem] tracking-[0.18em] text-[#696d63] uppercase">Invoice</p>
							<p className="font-mono text-sm font-semibold">INV-2026-0058</p>
						</div>
					</div>

					<div className="mt-5 grid grid-cols-3 gap-3 rounded-md bg-[#141710] p-3.5 text-white">
						<div>
							<p className="text-[0.625rem] tracking-wider text-white/60 uppercase">Amount due</p>
							<p className="mt-0.5 font-semibold tabular-nums">{money(total)}</p>
						</div>
						<div>
							<p className="text-[0.625rem] tracking-wider text-white/60 uppercase">Due</p>
							<p className="mt-0.5 text-sm">Dec 3, 2026</p>
						</div>
						<div>
							<p className="text-[0.625rem] tracking-wider text-white/60 uppercase">Bill to</p>
							<p className="mt-0.5 truncate text-sm">Nordlys AS</p>
						</div>
					</div>

					<div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-[#e5e7e0] pb-2 text-[0.625rem] tracking-wider text-[#696d63] uppercase">
						<span>Description</span>
						<span className="text-right">Qty</span>
						<span className="w-20 text-right">Amount</span>
					</div>
					<ul className="min-h-[7.5rem]">
						<AnimatePresence initial={false}>
							{LINES.slice(0, lines).map((line) => (
								<motion.li
									key={line.description}
									layout
									initial={{ opacity: 0, y: -6, backgroundColor: "rgba(143,255,74,0.35)" }}
									animate={{ opacity: 1, y: 0, backgroundColor: "rgba(143,255,74,0)" }}
									exit={{ opacity: 0 }}
									transition={{ ...transitions.smooth, backgroundColor: { duration: 1.2 } }}
									className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-[#eef0ea] py-2.5 text-sm"
								>
									<Typed text={line.description} />
									<span className="text-right tabular-nums text-[#696d63]">{line.qty}</span>
									<span className="w-20 text-right tabular-nums">
										{money(line.total ?? line.rate, "EUR", 0)}
									</span>
								</motion.li>
							))}
						</AnimatePresence>
					</ul>
					<div className="mt-4 flex items-end justify-between">
						<p className="max-w-[12rem] text-[0.6875rem] text-[#696d63]">
							IBAN EE38 2200 2210 2014 5685 · Thanks for your business!
						</p>
						<div className="text-right">
							<p className="text-xs text-[#696d63]">Total due</p>
							<p className="text-2xl font-semibold tracking-tight tabular-nums">{money(total)}</p>
						</div>
					</div>

					{/* The "PAID" stamp. */}
					<AnimatePresence>
						{status === "paid" ? (
							<motion.div
								initial={{ opacity: 0, scale: 1.6, rotate: -18 }}
								animate={{ opacity: 1, scale: 1, rotate: -10 }}
								exit={{ opacity: 0 }}
								transition={{ type: "spring", stiffness: 380, damping: 16 }}
								className="pointer-events-none absolute right-[18%] bottom-[24%] rounded-md border-[3px] border-[#2f9e6e] px-3 py-1 text-xl font-bold tracking-widest text-[#2f9e6e]"
							>
								PAID
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			</Window>

			{/* Little notes floating around the window. */}
			<Floating show={step >= 1 && step < 4} className="-top-4 -left-4 sm:-left-8">
				<span className="size-1.5 animate-pulse rounded-full bg-primary" /> Saved
			</Floating>
			<Floating show={step === 4} className="-top-4 right-4">
				<Send className="size-3.5 text-brand-ink" /> Sent to faktura@nordlys.no
			</Floating>
			<Floating show={step >= 5} className="-bottom-4 left-6">
				<Check className="size-3.5 text-success" /> Payment received · {money(12140)}
			</Floating>
		</div>
	);
}

function StatusPill({ status }: { status: Status }) {
	const config = {
		draft: { icon: CircleDashed, label: "Draft", className: "text-muted-foreground" },
		issued: { icon: FileCheck2, label: "Issued", className: "text-brand-ink" },
		paid: { icon: Check, label: "Paid", className: "text-success" },
	}[status];
	const Icon = config.icon;
	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.span
				key={status}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -6 }}
				transition={transitions.snappy}
				className={cn("inline-flex items-center gap-1 text-xs font-medium", config.className)}
			>
				<Icon className="size-3.5" />
				{config.label}
			</motion.span>
		</AnimatePresence>
	);
}

/** Text that types itself, with a caret while it does. */
function Typed({ text }: { text: string }) {
	return (
		<span className="relative truncate">
			<motion.span
				initial={{ clipPath: "inset(0 100% 0 0)" }}
				animate={{ clipPath: "inset(0 0% 0 0)" }}
				transition={{ duration: 0.6, ease: "linear" }}
				className="inline-block"
			>
				{text}
			</motion.span>
		</span>
	);
}

function Floating({
	show,
	className,
	children,
}: {
	show: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<AnimatePresence>
			{show ? (
				<motion.div
					initial={{ opacity: 0, y: 10, scale: 0.9 }}
					animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
					exit={{ opacity: 0, y: -8, scale: 0.95 }}
					transition={{
						...transitions.snappy,
						y: { duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
					}}
					className={cn(
						"absolute z-10 flex items-center gap-2 rounded-lg border bg-popover/90 px-3 py-2 text-xs whitespace-nowrap shadow-xl backdrop-blur-xl",
						className,
					)}
				>
					{children}
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
