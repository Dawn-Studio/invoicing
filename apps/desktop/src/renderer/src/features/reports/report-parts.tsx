import { currencyExponent, fromMinor, type MonthTotals } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dawnstudio/ui/components/tooltip";
import { cn } from "@dawnstudio/ui/lib/utils";
import { ChevronDown, Coins } from "lucide-react";
import type { ReactNode } from "react";
import { formatAmount } from "../../lib/format";

/** "12.5K" for 1250000 minor units of EUR: chart axes and other tight spots. */
export function formatCompact(minor: number, currency: string): string {
	return new Intl.NumberFormat(undefined, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(Number(fromMinor(minor, currency)));
}

/** A headline figure: label, value with its currency, and a quiet note underneath. */
export function StatTile({
	label,
	icon,
	value,
	currency,
	note,
	tone,
}: {
	label: string;
	icon?: ReactNode;
	value: number;
	currency: string;
	note?: ReactNode;
	tone?: "danger";
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-panel px-4 py-3.5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] dark:shadow-none">
			<div className="flex items-center gap-1.5 text-sm text-muted-foreground [&_svg]:size-3.5">
				{icon}
				{label}
			</div>
			<div className="flex items-baseline gap-1.5">
				<span
					className={cn(
						"truncate text-2xl font-medium tracking-tight",
						tone === "danger" && value > 0 && "text-destructive",
					)}
				>
					{formatAmount(value, currency)}
				</span>
				<span className="font-mono text-xs text-muted-foreground uppercase">{currency}</span>
			</div>
			{note ? <div className="truncate text-xs text-muted-foreground">{note}</div> : null}
		</div>
	);
}

/** Picks the currency a report is in; hidden while there's only one. */
export function CurrencyMenu({
	currency,
	currencies,
	onChange,
}: {
	currency: string;
	currencies: string[];
	onChange: (currency: string) => void;
}) {
	if (currencies.length < 2) return null;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="font-normal">
					<Coins />
					{currency}
					<ChevronDown className="text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-36">
				<DropdownMenuRadioGroup value={currency} onValueChange={onChange}>
					{currencies.map((code) => (
						<DropdownMenuRadioItem key={code} value={code}>
							{code}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const monthShort = new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat(undefined, {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});
const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);

/** Rounds up to 1, 2, 2.5 or 5 × 10ⁿ so axis ticks land on clean numbers. */
function niceMax(value: number): number {
	if (value <= 0) return 1;
	const power = 10 ** Math.floor(Math.log10(value));
	const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value) ?? 10;
	return step * power;
}

const TICKS = 4;

/**
 * Money received per month as columns on one baseline. Each column is a hover target that
 * shows the month's received and invoiced amounts; the current month is labelled.
 */
export function MonthlyChart({ months, currency }: { months: MonthTotals[]; currency: string }) {
	const unit = 10 ** currencyExponent(currency);
	// Scale in whole currency units so the ticks are round numbers people recognise.
	const max = niceMax(Math.max(...months.map((m) => m.received)) / unit) * unit;
	const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * (TICKS - i));
	const empty = months.every((m) => m.received === 0);

	return (
		<figure className="flex flex-col gap-2" aria-label={`Received per month in ${currency}`}>
			<div className="flex h-44 gap-2">
				{/* Y-axis */}
				<div className="flex w-10 shrink-0 flex-col justify-between text-right text-[0.6875rem] text-muted-foreground tabular-nums">
					{ticks.map((tick) => (
						<span key={tick} className="-my-1.5 leading-3">
							{empty && tick > 0 ? "" : formatCompact(tick, currency)}
						</span>
					))}
				</div>
				<div className="relative flex-1">
					{ticks.map((tick, i) => (
						<div
							key={tick}
							className={cn(
								"absolute inset-x-0 border-t",
								i === TICKS ? "border-border" : "border-border/50",
							)}
							style={{ top: `${(i / TICKS) * 100}%` }}
						/>
					))}
					<div className="absolute inset-0 flex">
						{months.map((month) => (
							<MonthColumn key={month.month} month={month} max={max} currency={currency} />
						))}
					</div>
					{empty ? (
						<div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
							No payments in the last 12 months
						</div>
					) : null}
				</div>
			</div>
			{/* X-axis */}
			<div className="flex gap-2 pl-12 text-[0.6875rem] text-muted-foreground">
				{months.map((month, i) => (
					<span
						key={month.month}
						className={cn("flex-1 text-center", i === months.length - 1 && "text-foreground")}
					>
						{monthShort.format(monthDate(month.month))}
					</span>
				))}
			</div>
		</figure>
	);
}

function MonthColumn({
	month,
	max,
	currency,
}: {
	month: MonthTotals;
	max: number;
	currency: string;
}) {
	const height = (month.received / max) * 100;
	return (
		<Tooltip delayDuration={0}>
			<TooltipTrigger asChild>
				<button
					type="button"
					className="group flex h-full flex-1 cursor-default items-end justify-center px-px outline-none"
					aria-label={`${monthLong.format(monthDate(month.month))}: received ${formatAmount(month.received, currency)} ${currency}`}
				>
					<span
						className="block w-full max-w-6 rounded-t-[4px] bg-brand-ink transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring"
						style={{ height: month.received > 0 ? `max(${height}%, 2px)` : 0 }}
					/>
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" className="flex min-w-44 flex-col gap-1 py-2">
				<span className="font-medium">{monthLong.format(monthDate(month.month))}</span>
				<span className="flex justify-between gap-4">
					<span className="opacity-70">Received</span>
					<span className="tabular-nums">
						{formatAmount(month.received, currency)} {currency}
					</span>
				</span>
				<span className="flex justify-between gap-4">
					<span className="opacity-70">Invoiced</span>
					<span className="tabular-nums">
						{formatAmount(month.invoiced, currency)} {currency}
					</span>
				</span>
			</TooltipContent>
		</Tooltip>
	);
}
