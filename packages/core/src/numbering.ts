import { type IsoDate, parseIsoDate } from "./dates";

const TOKEN = /\{([A-Z]+)(?::(\d+))?\}/g;
const DATE_TOKENS = new Set(["YYYY", "YY", "MM", "DD"]);
const MAX_SEQUENCE_WIDTH = 12;

export const DEFAULT_NUMBER_PATTERN = "INV-{YYYY}-{SEQ:4}";

/** Returns a user-facing problem with the pattern, or null when it is valid. */
export function validateNumberPattern(pattern: string): string | null {
	if (pattern.trim() === "") return "Pattern can't be empty";
	if (pattern.length > 64) return "Pattern is too long";
	let sequences = 0;
	for (const [, name, width] of pattern.matchAll(TOKEN)) {
		if (name === "SEQ") {
			sequences++;
			if (width !== undefined && (Number(width) < 1 || Number(width) > MAX_SEQUENCE_WIDTH)) {
				return `Sequence width must be between 1 and ${MAX_SEQUENCE_WIDTH}`;
			}
		} else if (!name || !DATE_TOKENS.has(name) || width !== undefined) {
			return `Unknown token {${name}${width ? `:${width}` : ""}}`;
		}
	}
	if (sequences !== 1) return "Pattern must contain {SEQ} exactly once, e.g. INV-{SEQ:4}";
	return null;
}

/** Formats an invoice number, e.g. ("INV-{YYYY}-{SEQ:4}", 42, "2026-11-17") → "INV-2026-0042". */
export function formatInvoiceNumber(pattern: string, sequence: number, issueDate: IsoDate): string {
	const problem = validateNumberPattern(pattern);
	if (problem) throw new RangeError(problem);
	const { year, month, day } = parseIsoDate(issueDate);
	const values: Record<string, string> = {
		YYYY: String(year),
		YY: String(year).slice(-2),
		MM: String(month).padStart(2, "0"),
		DD: String(day).padStart(2, "0"),
	};
	return pattern.replaceAll(TOKEN, (_, name: string, width?: string) =>
		name === "SEQ" ? String(sequence).padStart(Number(width ?? 1), "0") : (values[name] ?? ""),
	);
}
