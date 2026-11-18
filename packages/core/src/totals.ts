import { divRound, toSafeInteger } from "./decimal";
import { QUANTITY_UNIT, RATE_UNIT } from "./money";

export type Discount = { type: "percent"; value: number } | { type: "amount"; value: number };

export interface LineInput {
	/** Integer thousandths. */
	quantity: number;
	/** Minor units. */
	unitPrice: number;
	/** Basis points. */
	taxRate: number;
}

export interface LineTotals {
	/** quantity × unit price, before the invoice discount. */
	amount: number;
	/** This line's share of the invoice discount. */
	discount: number;
	/** amount − discount: the taxable base for this line. */
	net: number;
}

export interface TaxTotal {
	rate: number;
	base: number;
	amount: number;
}

export interface InvoiceTotals {
	lines: LineTotals[];
	subtotal: number;
	discountTotal: number;
	taxes: TaxTotal[];
	taxTotal: number;
	total: number;
}

export function lineAmount(line: Pick<LineInput, "quantity" | "unitPrice">): number {
	return toSafeInteger(
		divRound(BigInt(line.quantity) * BigInt(line.unitPrice), BigInt(QUANTITY_UNIT)),
	);
}

/**
 * Invoice math, all in integer minor units:
 * 1. Each line amount is rounded once (half away from zero).
 * 2. The invoice discount is spread across positive lines in proportion to their amount
 *    (largest-remainder, so the shares add up exactly).
 * 3. Tax is computed once per rate on the summed net of that rate's lines.
 */
export function computeTotals(lines: LineInput[], discount: Discount | null): InvoiceTotals {
	const amounts = lines.map(lineAmount);
	const subtotal = amounts.reduce((sum, amount) => sum + amount, 0);
	const discountTotal = discountAmount(subtotal, discount);
	const shares = allocate(discountTotal, amounts);

	const lineTotals = amounts.map((amount, i) => {
		const share = shares[i] ?? 0;
		return { amount, discount: share, net: amount - share };
	});

	const baseByRate = new Map<number, number>();
	lines.forEach((line, i) => {
		if (line.taxRate === 0) return;
		baseByRate.set(line.taxRate, (baseByRate.get(line.taxRate) ?? 0) + (lineTotals[i]?.net ?? 0));
	});
	const taxes = [...baseByRate].map(([rate, base]) => ({
		rate,
		base,
		amount: toSafeInteger(divRound(BigInt(base) * BigInt(rate), BigInt(RATE_UNIT))),
	}));
	const taxTotal = taxes.reduce((sum, tax) => sum + tax.amount, 0);

	return {
		lines: lineTotals,
		subtotal,
		discountTotal,
		taxes,
		taxTotal,
		total: subtotal - discountTotal + taxTotal,
	};
}

function discountAmount(subtotal: number, discount: Discount | null): number {
	if (!discount || subtotal <= 0) return 0;
	const raw =
		discount.type === "percent"
			? toSafeInteger(divRound(BigInt(subtotal) * BigInt(discount.value), BigInt(RATE_UNIT)))
			: discount.value;
	return Math.min(Math.max(raw, 0), subtotal);
}

/** Splits `total` across positive weights so the parts sum to exactly `total`. */
function allocate(total: number, weights: number[]): number[] {
	const shares = weights.map(() => 0);
	const positive = weights.map((weight, index) => ({ weight, index })).filter((w) => w.weight > 0);
	const weightSum = BigInt(positive.reduce((sum, w) => sum + w.weight, 0));
	if (total === 0 || weightSum === 0n) return shares;

	let assigned = 0;
	const remainders = positive.map(({ weight, index }) => {
		const exact = BigInt(total) * BigInt(weight);
		const share = Number(exact / weightSum);
		shares[index] = share;
		assigned += share;
		return { index, remainder: exact % weightSum };
	});
	remainders.sort((a, b) =>
		a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
	);
	for (let i = 0; i < total - assigned; i++) {
		const target = remainders[i % remainders.length];
		if (target) shares[target.index] = (shares[target.index] ?? 0) + 1;
	}
	return shares;
}
