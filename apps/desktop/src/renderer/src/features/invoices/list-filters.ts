import { type InvoiceSummary, todayIso } from "@dawnstudio/core";
import { type DisplayStatus, displayStatus } from "./invoice-row";

/** The invoice list's filters, kept in the URL so Back returns to the same view. */

export const STATUS_TABS = [
	{ value: "all", label: "All" },
	{ value: "draft", label: "Drafts" },
	{ value: "open", label: "Open" },
	{ value: "overdue", label: "Overdue" },
	{ value: "paid", label: "Paid" },
	{ value: "void", label: "Void" },
] as const;
export type StatusTab = (typeof STATUS_TABS)[number]["value"];

/** Which tab an invoice belongs to besides "all" (open includes overdue and part-paid). */
export function inTab(tab: StatusTab, status: DisplayStatus): boolean {
	switch (tab) {
		case "all":
			return true;
		case "open":
			return status === "issued" || status === "overdue" || status === "partial";
		default:
			return status === tab;
	}
}

export const tabCounts = (invoices: InvoiceSummary[], today = todayIso()) =>
	Object.fromEntries(
		STATUS_TABS.map(({ value }) => [
			value,
			invoices.filter((invoice) => inTab(value, displayStatus(invoice, today))).length,
		]),
	) as Record<StatusTab, number>;

export const PERIODS = [
	{ value: "this-month", label: "This month" },
	{ value: "last-month", label: "Last month" },
	{ value: "this-quarter", label: "This quarter" },
	{ value: "last-quarter", label: "Last quarter" },
	{ value: "this-year", label: "This year" },
	{ value: "last-year", label: "Last year" },
] as const;
export type Period = (typeof PERIODS)[number]["value"];

const iso = (year: number, month: number, day: number) =>
	new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

/** Issue-date range for a period, relative to today. */
export function periodRange(period: Period, today = todayIso()): { from: string; to: string } {
	const [year = 0, month = 1] = today.split("-").map(Number);
	const m = month - 1;
	const quarter = Math.floor(m / 3) * 3;
	switch (period) {
		case "this-month":
			return { from: iso(year, m, 1), to: iso(year, m + 1, 0) };
		case "last-month":
			return { from: iso(year, m - 1, 1), to: iso(year, m, 0) };
		case "this-quarter":
			return { from: iso(year, quarter, 1), to: iso(year, quarter + 3, 0) };
		case "last-quarter":
			return { from: iso(year, quarter - 3, 1), to: iso(year, quarter, 0) };
		case "this-year":
			return { from: iso(year, 0, 1), to: iso(year, 11, 31) };
		case "last-year":
			return { from: iso(year - 1, 0, 1), to: iso(year - 1, 11, 31) };
	}
}
