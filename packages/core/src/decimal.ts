import { DomainError } from "./errors";

/** Integer division rounded half away from zero ("commercial" rounding used on invoices). */
export function divRound(numerator: bigint, denominator: bigint): bigint {
	if (denominator === 0n) throw new RangeError("Division by zero");
	const negative = numerator < 0n !== denominator < 0n;
	const n = numerator < 0n ? -numerator : numerator;
	const d = denominator < 0n ? -denominator : denominator;
	const quotient = (n * 2n + d) / (2n * d);
	return negative ? -quotient : quotient;
}

export function toSafeInteger(value: bigint): number {
	if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
		throw new DomainError("VALIDATION", "Amount is too large");
	}
	return Number(value);
}

const DECIMAL_PATTERN = /^([+-])?(\d*)(?:[.,](\d*))?$/;

/**
 * Parses a decimal string into an integer scaled by 10^scale, without floating point.
 * Accepts "." or "," as the decimal separator; rejects thousands separators and
 * more fractional digits than `scale` (no silent rounding of user input).
 */
export function parseDecimal(input: string, scale: number): number {
	const trimmed = input.replaceAll(/\s/g, "");
	const match = DECIMAL_PATTERN.exec(trimmed);
	const whole = match?.[2] ?? "";
	const fraction = match?.[3] ?? "";
	if (!match || (whole === "" && fraction === "")) {
		throw new DomainError("VALIDATION", `"${input}" is not a number`);
	}
	if (fraction.length > scale) {
		throw new DomainError("VALIDATION", `"${input}" has more than ${scale} decimal places`);
	}
	const digits = `${whole || "0"}${fraction.padEnd(scale, "0")}`;
	const value = BigInt(digits);
	return toSafeInteger(match[1] === "-" ? -value : value);
}

/** Formats an integer scaled by 10^scale as a plain decimal string, e.g. (1050, 2) → "10.50". */
export function formatDecimal(value: number, scale: number): string {
	const negative = value < 0;
	const digits = Math.abs(value)
		.toString()
		.padStart(scale + 1, "0");
	const whole = digits.slice(0, digits.length - scale);
	const fraction = digits.slice(digits.length - scale);
	return `${negative ? "-" : ""}${whole}${scale > 0 ? `.${fraction}` : ""}`;
}
