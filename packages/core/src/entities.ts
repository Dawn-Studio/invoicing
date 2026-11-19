import type { z } from "zod";
import type {
	catalogItemInputSchema,
	clientInputSchema,
	invoiceItemInputSchema,
	paymentAccountInputSchema,
	paymentInputSchema,
	profileInputSchema,
	taxRateInputSchema,
} from "./schemas";
import type { InvoiceSnapshot } from "./snapshot";
import type { Discount, TaxTotal } from "./totals";

/** Records as the app reads them back. Timestamps are Unix milliseconds. */
interface Timestamps {
	createdAt: number;
	updatedAt: number;
}

export interface BusinessProfile extends z.output<typeof profileInputSchema>, Timestamps {
	id: string;
	/** File name of the logo inside the app's logo folder, or null. */
	logoFile: string | null;
}

export interface PaymentAccount extends z.output<typeof paymentAccountInputSchema>, Timestamps {
	id: string;
	archivedAt: number | null;
}

export interface Client extends z.output<typeof clientInputSchema>, Timestamps {
	id: string;
	archivedAt: number | null;
}

export interface TaxRate extends z.output<typeof taxRateInputSchema>, Timestamps {
	id: string;
	archivedAt: number | null;
}

export interface CatalogItem extends z.output<typeof catalogItemInputSchema>, Timestamps {
	id: string;
	archivedAt: number | null;
}

export const INVOICE_STATUSES = ["draft", "issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceItem extends z.output<typeof invoiceItemInputSchema> {
	id: string;
	position: number;
}

export interface Invoice extends Timestamps {
	id: string;
	/** Assigned when the invoice is issued. */
	number: string | null;
	status: InvoiceStatus;
	clientId: string | null;
	paymentAccountId: string | null;
	currency: string;
	issueDate: string;
	dueDate: string;
	discount: Discount | null;
	notes: string;
	terms: string;
	subtotal: number;
	discountTotal: number;
	taxes: TaxTotal[];
	taxTotal: number;
	total: number;
	/** Sum of recorded payments; the balance due is `total - amountPaid`. */
	amountPaid: number;
	issuedAt: number | null;
	paidAt: number | null;
	voidedAt: number | null;
	items: InvoiceItem[];
	/** Frozen copy of everything printed on the invoice; set when issued, never changed. */
	snapshot: InvoiceSnapshot | null;
}

/** Row shape for invoice lists. */
export interface InvoiceSummary {
	id: string;
	number: string | null;
	status: InvoiceStatus;
	clientId: string | null;
	clientName: string | null;
	currency: string;
	issueDate: string;
	dueDate: string;
	total: number;
	amountPaid: number;
	updatedAt: number;
}

export const INVOICE_EVENT_TYPES = [
	"created",
	"issued",
	"payment",
	"paymentRemoved",
	"paid",
	"unpaid",
	"voided",
	"exported",
	"sent",
] as const;
export type InvoiceEventType = (typeof INVOICE_EVENT_TYPES)[number];

export interface InvoiceEvent {
	id: string;
	invoiceId: string;
	type: InvoiceEventType;
	payload: Record<string, unknown>;
	createdAt: number;
}

export interface Payment extends z.output<typeof paymentInputSchema> {
	id: string;
	invoiceId: string;
	createdAt: number;
}

/** Totals for one client in one currency. Drafts and void invoices are not counted. */
export interface ClientCurrencyTotals {
	currency: string;
	/** Issued + paid. */
	billed: number;
	paid: number;
	/** Issued and not yet paid. */
	outstanding: number;
	/** Outstanding and past the due date. */
	overdue: number;
}

export interface ClientStats {
	/** Issued, paid and void invoices. */
	invoiceCount: number;
	draftCount: number;
	lastIssueDate: string | null;
	totals: ClientCurrencyTotals[];
}

export interface ClientImportResult {
	created: number;
	/** Names that already existed (case-insensitive) or appeared twice in the import. */
	skipped: string[];
}

/** Money in one currency, plus how many invoices it comes from. */
export interface AmountCount {
	amount: number;
	count: number;
}

export interface MonthTotals {
	/** "YYYY-MM" */
	month: string;
	/** Issued in that month (void excluded). */
	invoiced: number;
	/** Payments dated in that month. */
	received: number;
}

/** Dashboard figures for one currency. */
export interface DashboardReport {
	currency: string;
	/** Currencies with issued invoices, most used first; the switcher's options. */
	currencies: string[];
	outstanding: AmountCount;
	overdue: AmountCount;
	receivedThisMonth: number;
	receivedThisYear: number;
	/** The last 12 months, oldest first, including the current one. */
	months: MonthTotals[];
	/** Overdue invoices, longest overdue first. */
	overdueInvoices: InvoiceSummary[];
	draftCount: number;
}

export interface ClientRevenue {
	clientId: string | null;
	name: string;
	invoiceCount: number;
	invoiced: number;
	received: number;
	outstanding: number;
}

export interface TaxSummaryRow {
	/** Basis points. */
	rate: number;
	base: number;
	amount: number;
	invoiceCount: number;
}

/** A period's figures for one currency (issue dates for invoiced, payment dates for received). */
export interface PeriodReport {
	currency: string;
	currencies: string[];
	from: string;
	to: string;
	invoiced: AmountCount;
	received: AmountCount;
	taxTotal: number;
	clients: ClientRevenue[];
	taxes: TaxSummaryRow[];
}
