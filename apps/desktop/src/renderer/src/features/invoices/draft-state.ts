import {
	addDays,
	type Client,
	type Discount,
	formatQuantity,
	formatRate,
	fromMinor,
	type Invoice,
	type InvoiceDraftInput,
	type PaymentAccount,
	parseQuantity,
	parseRate,
	toMinor,
} from "@dawnstudio/core";

/**
 * What the editor holds while you type. Numbers stay as the text you typed until they are
 * saved, so "1." or "" don't get rewritten under your cursor.
 */
export interface LineState {
	/** Stable across reorders; not stored. */
	key: string;
	description: string;
	quantity: string;
	unit: string;
	unitPrice: string;
	taxRateId: string | null;
	/** Basis points, copied from the tax rate. */
	taxRate: number;
}

export type DiscountType = "none" | "percent" | "amount";

export interface DraftState {
	clientId: string | null;
	paymentAccountId: string | null;
	currency: string;
	issueDate: string;
	dueDate: string;
	discountType: DiscountType;
	discountValue: string;
	notes: string;
	terms: string;
	items: LineState[];
}

export const newLineKey = () => crypto.randomUUID();

export function emptyLine(taxRate: { id: string; rate: number } | null = null): LineState {
	return {
		key: newLineKey(),
		description: "",
		quantity: "1",
		unit: "",
		unitPrice: "",
		taxRateId: taxRate?.id ?? null,
		taxRate: taxRate?.rate ?? 0,
	};
}

export function stateFromInvoice(invoice: Invoice): DraftState {
	const discount = invoice.discount;
	return {
		clientId: invoice.clientId,
		paymentAccountId: invoice.paymentAccountId,
		currency: invoice.currency,
		issueDate: invoice.issueDate,
		dueDate: invoice.dueDate,
		discountType: discount?.type ?? "none",
		discountValue: !discount
			? ""
			: discount.type === "percent"
				? formatRate(discount.value)
				: fromMinor(discount.value, invoice.currency),
		notes: invoice.notes,
		terms: invoice.terms,
		items: invoice.items.map((item) => ({
			key: item.id,
			description: item.description,
			quantity: formatQuantity(item.quantity),
			unit: item.unit,
			unitPrice: item.unitPrice === 0 ? "" : fromMinor(item.unitPrice, invoice.currency),
			taxRateId: item.taxRateId,
			taxRate: item.taxRate,
		})),
	};
}

/** Field errors keyed like "items.<key>.quantity", "discount" or "dueDate". */
export type DraftErrors = Record<string, string>;

export interface ParsedDraft {
	input: InvoiceDraftInput;
	errors: DraftErrors;
}

/**
 * Turns the editor state into what the main process stores. Fields that don't parse are
 * reported in `errors` and count as 0 in `input`, so the preview and totals keep working.
 */
export function parseDraft(state: DraftState): ParsedDraft {
	const errors: DraftErrors = {};
	const read = (key: string, text: string, parse: (text: string) => number) => {
		if (text.trim() === "") return 0;
		try {
			return parse(text);
		} catch (error) {
			errors[key] = error instanceof Error ? error.message : "Not a number";
			return 0;
		}
	};

	let discount: Discount | null = null;
	if (state.discountType !== "none") {
		const value = read(
			"discount",
			state.discountValue,
			state.discountType === "percent" ? parseRate : (text) => toMinor(text, state.currency),
		);
		if (value < 0) errors.discount = "Discount can't be negative";
		else if (state.discountType === "percent" && value > 10_000) {
			errors.discount = "Discount can't be more than 100%";
		}
		discount = { type: state.discountType, value: errors.discount ? 0 : value };
	}
	if (state.dueDate && state.issueDate && state.dueDate < state.issueDate) {
		errors.dueDate = "Due date is before the issue date";
	}
	if (!state.issueDate) errors.issueDate = "Choose a date";
	if (!state.dueDate) errors.dueDate = "Choose a date";

	const items = state.items.map((line) => ({
		description: line.description,
		unit: line.unit,
		quantity: read(`items.${line.key}.quantity`, line.quantity, parseQuantity),
		unitPrice: read(`items.${line.key}.unitPrice`, line.unitPrice, (text) =>
			toMinor(text, state.currency),
		),
		taxRateId: line.taxRateId,
		taxRate: line.taxRate,
	}));

	return {
		errors,
		input: {
			clientId: state.clientId,
			paymentAccountId: state.paymentAccountId,
			currency: state.currency,
			issueDate: state.issueDate,
			dueDate: state.dueDate,
			discount,
			notes: state.notes,
			terms: state.terms,
			items,
		},
	};
}

/** Days between issue and due date, used to keep the terms when the issue date moves. */
export function termDays(state: Pick<DraftState, "issueDate" | "dueDate">): number {
	const days = Math.round((Date.parse(state.dueDate) - Date.parse(state.issueDate)) / 86_400_000);
	return Number.isFinite(days) ? Math.max(0, days) : 0;
}

/** The account to bill in a currency: the default one for it, else any for it. */
export function accountFor(accounts: PaymentAccount[], currency: string): PaymentAccount | null {
	return (
		accounts.find((a) => a.isDefault && a.currency === currency) ??
		accounts.find((a) => a.currency === currency) ??
		null
	);
}

/**
 * Picking a client re-applies its billing defaults: currency, payment terms, and a payment
 * account in that currency. The same defaults a new draft for that client would get.
 */
export function applyClient(
	state: DraftState,
	client: Client | null,
	defaults: { currency: string; paymentTermsDays: number },
	accounts: PaymentAccount[],
): DraftState {
	const currency = client?.currency ?? defaults.currency;
	const terms = client?.paymentTermsDays ?? defaults.paymentTermsDays;
	return {
		...applyCurrency(state, currency, accounts),
		clientId: client?.id ?? null,
		dueDate: state.issueDate ? addDays(state.issueDate, terms) : state.dueDate,
	};
}

/** Switching currency keeps the account only if it's in the new currency. */
export function applyCurrency(
	state: DraftState,
	currency: string,
	accounts: PaymentAccount[],
): DraftState {
	const current = accounts.find((a) => a.id === state.paymentAccountId);
	return {
		...state,
		currency,
		paymentAccountId:
			current?.currency === currency ? current.id : (accountFor(accounts, currency)?.id ?? null),
	};
}
