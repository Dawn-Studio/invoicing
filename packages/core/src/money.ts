import { currencyExponent } from "./currency";
import { formatDecimal, parseDecimal } from "./decimal";

/**
 * All money is stored as an integer number of minor units (cents) next to its ISO 4217 code.
 * These helpers convert between user-facing decimal strings and minor units.
 */
export function toMinor(input: string, currency: string): number {
	return parseDecimal(input, currencyExponent(currency));
}

export function fromMinor(amount: number, currency: string): string {
	return formatDecimal(amount, currencyExponent(currency));
}

export function formatMoney(amount: number, currency: string, locale?: string): string {
	return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
		fromMinor(amount, currency) as Intl.StringNumericLiteral,
	);
}

/** Quantities are integer thousandths, so "1.5" hours is stored as 1500. */
export const QUANTITY_SCALE = 3;
export const QUANTITY_UNIT = 10 ** QUANTITY_SCALE;

export function parseQuantity(input: string): number {
	return parseDecimal(input, QUANTITY_SCALE);
}

export function formatQuantity(quantity: number): string {
	return formatDecimal(quantity, QUANTITY_SCALE).replace(/\.?0+$/, "");
}

/** Rates are integer basis points, so "20" percent is stored as 2000. */
export const RATE_SCALE = 2;
export const RATE_UNIT = 10_000;

export function parseRate(percent: string): number {
	return parseDecimal(percent, RATE_SCALE);
}

export function formatRate(rate: number): string {
	return formatDecimal(rate, RATE_SCALE).replace(/\.?0+$/, "");
}
