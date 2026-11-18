import { describe, expect, it } from "vitest";
import { currencyExponent, isCurrencyCode } from "./currency";
import {
	formatMoney,
	formatQuantity,
	formatRate,
	fromMinor,
	parseQuantity,
	parseRate,
	toMinor,
} from "./money";

describe("currencies", () => {
	it("knows minor unit digits", () => {
		expect(currencyExponent("USD")).toBe(2);
		expect(currencyExponent("EUR")).toBe(2);
		expect(currencyExponent("JPY")).toBe(0);
		expect(currencyExponent("KWD")).toBe(3);
	});

	it("validates codes", () => {
		expect(isCurrencyCode("GBP")).toBe(true);
		expect(isCurrencyCode("XYZ")).toBe(false);
		expect(isCurrencyCode("usd")).toBe(false);
	});
});

describe("money", () => {
	it("converts between decimal strings and minor units per currency", () => {
		expect(toMinor("1234.56", "USD")).toBe(123456);
		expect(toMinor("1500", "JPY")).toBe(1500);
		expect(toMinor("1.234", "KWD")).toBe(1234);
		expect(fromMinor(123456, "USD")).toBe("1234.56");
		expect(fromMinor(1500, "JPY")).toBe("1500");
	});

	it("rejects more precision than the currency has", () => {
		expect(() => toMinor("10.5", "JPY")).toThrow();
	});

	it("formats for display without float error", () => {
		expect(formatMoney(123456, "USD", "en-US")).toBe("$1,234.56");
		expect(formatMoney(1500, "JPY", "en-US")).toBe("¥1,500");
		expect(formatMoney(900719925474099, "USD", "en-US")).toBe("$9,007,199,254,740.99");
	});
});

describe("quantities and rates", () => {
	it("stores quantities in thousandths", () => {
		expect(parseQuantity("1.5")).toBe(1500);
		expect(parseQuantity("2")).toBe(2000);
		expect(formatQuantity(1500)).toBe("1.5");
		expect(formatQuantity(2000)).toBe("2");
		expect(formatQuantity(100000)).toBe("100");
		expect(formatQuantity(1)).toBe("0.001");
	});

	it("stores rates in basis points", () => {
		expect(parseRate("20")).toBe(2000);
		expect(parseRate("7.5")).toBe(750);
		expect(formatRate(2000)).toBe("20");
		expect(formatRate(750)).toBe("7.5");
		expect(formatRate(0)).toBe("0");
	});
});
