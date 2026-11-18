import { currencyExponent, fromMinor } from "@dawnstudio/core";

const dateFormat = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** "17 Nov 2026" for a Unix-ms timestamp. */
export const formatTimestamp = (ms: number) => dateFormat.format(new Date(ms));

/** Joins the non-empty parts with " · ", as in "Jane Doe · jane@acme.com · Sweden". */
export const joinParts = (...parts: (string | null | undefined)[]) =>
	parts.filter((part) => part && part.trim() !== "").join(" · ");

const isoDateFormat = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

/** "17 Nov 2026" for a "2026-11-17" calendar date (no time-zone shift). */
export const formatIsoDate = (iso: string) => isoDateFormat.format(new Date(`${iso}T00:00:00Z`));

/** "1,217.00" for 121700 EUR: the figure only, for use next to a currency tag. */
export function formatAmount(minor: number, currency: string): string {
	const digits = currencyExponent(currency);
	return new Intl.NumberFormat(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(fromMinor(minor, currency) as Intl.StringNumericLiteral);
}
