import { describe, expect, it } from "vitest";
import { DEFAULT_NUMBER_PATTERN, formatInvoiceNumber, validateNumberPattern } from "./numbering";

describe("formatInvoiceNumber", () => {
	it("fills date and sequence tokens", () => {
		expect(formatInvoiceNumber(DEFAULT_NUMBER_PATTERN, 42, "2026-11-17")).toBe("INV-2026-0042");
		expect(formatInvoiceNumber("{YY}{MM}{DD}-{SEQ}", 7, "2026-03-05")).toBe("260305-7");
		expect(formatInvoiceNumber("#{SEQ:3}", 12345, "2026-01-01")).toBe("#12345");
	});
});

describe("validateNumberPattern", () => {
	it.each([DEFAULT_NUMBER_PATTERN, "{SEQ}", "DS/{YYYY}/{MM}/{SEQ:5}"])("accepts %s", (pattern) => {
		expect(validateNumberPattern(pattern)).toBeNull();
	});

	it.each([
		["", /empty/],
		["INV-{YYYY}", /exactly once/],
		["{SEQ}-{SEQ}", /exactly once/],
		["{SEQ}-{FOO}", /Unknown token/],
		["{YYYY:2}-{SEQ}", /Unknown token/],
		["{SEQ:0}", /between 1 and 12/],
	])("rejects %j", (pattern, message) => {
		expect(validateNumberPattern(pattern)).toMatch(message);
	});
});
