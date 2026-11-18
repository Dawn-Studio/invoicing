import {
	type Address,
	currencyExponent,
	formatQuantity,
	formatRate,
	fromMinor,
} from "@dawnstudio/core";

/**
 * Formatting for printed invoices. Kept here rather than in the app so the preview and the
 * PDF can never disagree.
 */

export function money(minor: number, currency: string): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
	}).format(fromMinor(minor, currency) as Intl.StringNumericLiteral);
}

/** "1,217.00": the figure without a symbol, for table cells. */
export function figure(minor: number, currency: string): string {
	const digits = currencyExponent(currency);
	return new Intl.NumberFormat(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(fromMinor(minor, currency) as Intl.StringNumericLiteral);
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

export const date = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

export const quantity = (value: number) =>
	new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(
		formatQuantity(value) as Intl.StringNumericLiteral,
	);

export const percent = (rate: number) => `${formatRate(rate)}%`;

/** Address as printed lines, skipping empty parts: "City Region Postcode" share a line. */
export function addressLines(address: Address): string[] {
	const cityLine = [address.postalCode, address.city, address.region].filter(Boolean).join(" ");
	return [address.line1, address.line2, cityLine, address.country].filter(
		(line) => line.trim() !== "",
	);
}
