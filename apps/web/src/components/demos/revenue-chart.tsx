import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { money, useCountUp, useVisible, Window } from "./shared";

const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const DATA = {
	received: [1200, 1800, 2300, 2100, 3100, 3600, 3300, 4400, 4100, 5200, 5000, 6100],
	invoiced: [1900, 2200, 2600, 2900, 3400, 3900, 4200, 4600, 4900, 5600, 5900, 6800],
};
type Series = keyof typeof DATA;
const MAX = 7000;

/** The dashboard chart: bars rise in, a toggle switches series, hovering shows the month. */
export function RevenueChart() {
	const ref = useRef<HTMLDivElement>(null);
	const visible = useVisible(ref, true);
	const reduced = useReducedMotion();
	const [series, setSeries] = useState<Series>("received");
	const [hovered, setHovered] = useState<number | null>(null);
	const values = DATA[series];
	const total = useCountUp(
		values.reduce((sum, value) => sum + value, 0),
		visible,
	);

	return (
		<div ref={ref}>
			<Window title="Dashboard" bodyClassName="p-5 sm:p-6">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="text-sm text-muted-foreground">
							{series === "received" ? "Received" : "Invoiced"} · last 12 months
						</p>
						<p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
							{money(total, "EUR", 0)}
						</p>
					</div>
					<div className="grid grid-flow-col gap-1 rounded-lg bg-muted p-1 text-xs">
						{(["received", "invoiced"] as const).map((option) => (
							<button
								key={option}
								type="button"
								aria-pressed={series === option}
								onClick={() => setSeries(option)}
								className={cn(
									"relative rounded-md px-2.5 py-1 font-medium capitalize transition-colors",
									series === option
										? "text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{series === option ? (
									<motion.span
										layoutId="series"
										transition={transitions.snappy}
										className="absolute inset-0 rounded-md bg-background shadow-sm"
									/>
								) : null}
								<span className="relative">{option}</span>
							</button>
						))}
					</div>
				</div>

				<div className="relative mt-8 grid h-52 grid-cols-12 items-end gap-1.5 border-b sm:gap-2.5">
					{/* Grid lines. */}
					{[0.25, 0.5, 0.75].map((line) => (
						<span
							key={line}
							aria-hidden="true"
							className="absolute inset-x-0 border-t border-dashed border-border"
							style={{ bottom: `${line * 100}%` }}
						/>
					))}
					{values.map((value, index) => {
						const ratio = value / MAX;
						return (
							<button
								type="button"
								key={MONTHS[index]}
								aria-label={`${MONTHS[index]}: ${money(value, "EUR", 0)}`}
								className="relative flex h-full items-end outline-none"
								onMouseEnter={() => setHovered(index)}
								onMouseLeave={() => setHovered(null)}
								onFocus={() => setHovered(index)}
								onBlur={() => setHovered(null)}
							>
								<motion.div
									className="w-full rounded-t-[4px] bg-primary"
									initial={reduced ? false : { height: 0 }}
									animate={{
										height: visible ? `${ratio * 100}%` : 0,
										opacity: hovered === null || hovered === index ? 0.35 + ratio * 0.65 : 0.25,
									}}
									transition={{ ...transitions.smooth, delay: visible ? index * 0.04 : 0 }}
								/>
								{hovered === index ? (
									<motion.span
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										className="absolute left-1/2 z-10 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-lg tabular-nums"
										style={{ bottom: `calc(${ratio * 100}% + 8px)` }}
									>
										{MONTHS[index]} · {money(value, "EUR", 0)}
									</motion.span>
								) : null}
							</button>
						);
					})}
				</div>
				<div className="mt-2 grid grid-cols-12 gap-1.5 text-center text-[0.6875rem] text-muted-foreground sm:gap-2.5">
					{MONTHS.map((month, index) => (
						<span key={month} className={cn(index === 11 && "font-medium text-foreground")}>
							{month}
						</span>
					))}
				</div>
			</Window>
		</div>
	);
}
