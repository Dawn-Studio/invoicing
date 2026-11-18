import { describe, expect, it } from "vitest";
import { computeTotals, lineAmount } from "./totals";

const line = (quantity: number, unitPrice: number, taxRate = 0) => ({
	quantity,
	unitPrice,
	taxRate,
});

describe("lineAmount", () => {
	it("multiplies thousandths by minor units and rounds once", () => {
		expect(lineAmount(line(1500, 10000))).toBe(15000); // 1.5 × 100.00
		expect(lineAmount(line(333, 100))).toBe(33); // 0.333 × 1.00 = 0.333
		expect(lineAmount(line(335, 100))).toBe(34); // 0.335 → 0.34 (half up)
		expect(lineAmount(line(1000, -2500))).toBe(-2500);
	});
});

describe("computeTotals", () => {
	it("handles an invoice without tax or discount", () => {
		const totals = computeTotals([line(10000, 8000), line(2000, 5000)], null);
		expect(totals).toMatchObject({ subtotal: 90000, discountTotal: 0, taxTotal: 0, total: 90000 });
		expect(totals.taxes).toEqual([]);
	});

	it("taxes once per rate on the summed base", () => {
		// Three lines of 0.10 at 20%: per-line tax would round to 0.02 × 3 = 0.06; per-rate is 0.06 too,
		// but 1.05 + 1.05 at 10% shows the difference: per line 0.11 + 0.11, per rate 0.21.
		const totals = computeTotals([line(1000, 105, 1000), line(1000, 105, 1000)], null);
		expect(totals.taxes).toEqual([{ rate: 1000, base: 210, amount: 21 }]);
		expect(totals.total).toBe(231);
	});

	it("groups multiple tax rates and skips zero-rated lines", () => {
		const totals = computeTotals(
			[line(1000, 10000, 2000), line(1000, 5000, 500), line(1000, 3000, 0), line(1000, 1000, 2000)],
			null,
		);
		expect(totals.taxes).toEqual([
			{ rate: 2000, base: 11000, amount: 2200 },
			{ rate: 500, base: 5000, amount: 250 },
		]);
		expect(totals.total).toBe(19000 + 2450);
	});

	it("applies a percent discount before tax", () => {
		const totals = computeTotals([line(1000, 10000, 2000)], { type: "percent", value: 1000 });
		expect(totals).toMatchObject({
			subtotal: 10000,
			discountTotal: 1000,
			taxTotal: 1800,
			total: 10800,
		});
	});

	it("spreads a fixed discount so line shares add up exactly", () => {
		const totals = computeTotals([line(1000, 100), line(1000, 100), line(1000, 100)], {
			type: "amount",
			value: 100,
		});
		expect(totals.lines.map((l) => l.discount)).toEqual([34, 33, 33]);
		expect(totals.lines.reduce((sum, l) => sum + l.discount, 0)).toBe(100);
		expect(totals.total).toBe(200);
	});

	it("taxes each rate on its discounted base", () => {
		const totals = computeTotals([line(1000, 30000, 2000), line(1000, 10000, 0)], {
			type: "percent",
			value: 5000,
		});
		expect(totals.lines.map((l) => l.net)).toEqual([15000, 5000]);
		expect(totals.taxes).toEqual([{ rate: 2000, base: 15000, amount: 3000 }]);
		expect(totals.total).toBe(23000);
	});

	it("never discounts more than the subtotal", () => {
		const totals = computeTotals([line(1000, 500)], { type: "amount", value: 10000 });
		expect(totals.discountTotal).toBe(500);
		expect(totals.total).toBe(0);
	});

	it("only spreads the discount over positive lines", () => {
		const totals = computeTotals([line(1000, 10000), line(1000, -2000)], {
			type: "amount",
			value: 1000,
		});
		expect(totals.lines.map((l) => l.discount)).toEqual([1000, 0]);
		expect(totals.total).toBe(7000);
	});

	it("returns zeros for an empty invoice", () => {
		expect(computeTotals([], { type: "percent", value: 1000 })).toEqual({
			lines: [],
			subtotal: 0,
			discountTotal: 0,
			taxes: [],
			taxTotal: 0,
			total: 0,
		});
	});
});
