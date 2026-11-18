import { describe, expect, it } from "vitest";
import { divRound, formatDecimal, parseDecimal } from "./decimal";

describe("divRound", () => {
	it("rounds half away from zero", () => {
		expect(divRound(5n, 10n)).toBe(1n);
		expect(divRound(4n, 10n)).toBe(0n);
		expect(divRound(15n, 10n)).toBe(2n);
		expect(divRound(-5n, 10n)).toBe(-1n);
		expect(divRound(-4n, 10n)).toBe(0n);
		expect(divRound(5n, -10n)).toBe(-1n);
	});

	it("rejects division by zero", () => {
		expect(() => divRound(1n, 0n)).toThrow(RangeError);
	});
});

describe("parseDecimal", () => {
	it.each([
		["10", 2, 1000],
		["10.5", 2, 1050],
		["10,50", 2, 1050],
		[".5", 2, 50],
		["5.", 2, 500],
		["-1.25", 2, -125],
		["+3", 0, 3],
		[" 1 000.5 ", 1, 10005],
		["0.001", 3, 1],
	])("parses %s at scale %i", (input, scale, expected) => {
		expect(parseDecimal(input, scale)).toBe(expected);
	});

	it.each(["", ".", "abc", "1.2.3", "1,000.50", "--1"])("rejects %j", (input) => {
		expect(() => parseDecimal(input, 2)).toThrow();
	});

	it("refuses to silently round extra decimals", () => {
		expect(() => parseDecimal("1.005", 2)).toThrow(/more than 2 decimal places/);
	});

	it("rejects values outside the safe integer range", () => {
		expect(() => parseDecimal("100000000000000000", 2)).toThrow(/too large/);
	});
});

describe("formatDecimal", () => {
	it.each([
		[1050, 2, "10.50"],
		[5, 2, "0.05"],
		[-125, 2, "-1.25"],
		[42, 0, "42"],
		[1, 3, "0.001"],
	])("formats %i at scale %i", (value, scale, expected) => {
		expect(formatDecimal(value, scale)).toBe(expected);
	});
});
