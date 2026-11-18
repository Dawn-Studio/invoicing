import { z } from "zod";
import { isCurrencyCode } from "./currency";
import { isIsoDate } from "./dates";
import { validateNumberPattern } from "./numbering";

/**
 * Input schemas: what the UI sends when creating or editing records. The main process
 * validates every IPC payload against these, and the UI can reuse them for its forms.
 */

const text = (max = 200) => z.string().trim().max(max);
const optionalEmail = z.union([z.literal(""), z.email()]);

export const currencySchema = z
	.string()
	.trim()
	.toUpperCase()
	.refine(isCurrencyCode, { message: "Unknown currency code" });

export const isoDateSchema = z
	.string()
	.refine(isIsoDate, { message: "Expected a YYYY-MM-DD date" });

export const idSchema = z.uuid();

export const addressSchema = z.object({
	line1: text().default(""),
	line2: text().default(""),
	city: text(100).default(""),
	region: text(100).default(""),
	postalCode: text(20).default(""),
	country: text(100).default(""),
});
export type Address = z.infer<typeof addressSchema>;

export const TEMPLATES = ["classic", "modern", "minimal"] as const;
export const FONTS = ["sans", "serif", "mono"] as const;
export const PAPER_SIZES = ["a4", "letter"] as const;

/**
 * How invoices look. Every field has a default so branding saved by older versions (and
 * frozen in older snapshots) still parses.
 */
export const brandingSchema = z.object({
	accentColor: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #4f46e5")
		.default("#4f46e5"),
	/** Unknown ids (e.g. from a newer version) fall back to the default template. */
	template: text(50).default("classic"),
	font: z.enum(FONTS).catch("sans").default("sans"),
	logoPosition: z.enum(["left", "right"]).catch("left").default("left"),
	paperSize: z.enum(PAPER_SIZES).catch("a4").default("a4"),
	/** Small print at the bottom of every invoice, e.g. company registration details. */
	footer: text(500).default(""),
});
export type Branding = z.infer<typeof brandingSchema>;
export type BrandingInput = z.input<typeof brandingSchema>;

export const profileInputSchema = z.object({
	name: text().min(1, "Business name is required"),
	legalName: text().default(""),
	email: optionalEmail.default(""),
	phone: text(50).default(""),
	website: text().default(""),
	address: addressSchema.default(addressSchema.parse({})),
	taxId: text(50).default(""),
	defaultCurrency: currencySchema.default("USD"),
	paymentTermsDays: z.int().min(0).max(365).default(14),
	numberPattern: z
		.string()
		.trim()
		.refine((pattern) => validateNumberPattern(pattern) === null, {
			error: (issue) => validateNumberPattern(String(issue.input)) ?? "Invalid pattern",
		})
		.default("INV-{YYYY}-{SEQ:4}"),
	/** Next sequence number to use; editable so numbering can continue from another tool. */
	nextSequence: z.int().min(1).default(1),
	branding: brandingSchema.default(brandingSchema.parse({})),
});
export type ProfileInput = z.input<typeof profileInputSchema>;

export const paymentDetailSchema = z.object({ label: text(50).min(1), value: text(200).min(1) });
export type PaymentDetail = z.infer<typeof paymentDetailSchema>;

export const paymentAccountInputSchema = z.object({
	label: text(100).min(1, "Label is required"),
	currency: currencySchema,
	/** Free-form rows such as IBAN, SWIFT/BIC, account holder. */
	details: z.array(paymentDetailSchema).max(20).default([]),
	isDefault: z.boolean().default(false),
});
export type PaymentAccountInput = z.input<typeof paymentAccountInputSchema>;

export const clientContactSchema = z.object({
	name: text().default(""),
	email: z.email("Enter a valid email"),
});
export type ClientContact = z.infer<typeof clientContactSchema>;

export const clientInputSchema = z.object({
	name: text().min(1, "Client name is required"),
	contactName: text().default(""),
	email: optionalEmail.default(""),
	phone: text(50).default(""),
	address: addressSchema.default(addressSchema.parse({})),
	taxId: text(50).default(""),
	/** Overrides the business default currency on new invoices for this client. */
	currency: currencySchema.nullable().default(null),
	/** Overrides the business default payment terms. */
	paymentTermsDays: z.int().min(0).max(365).nullable().default(null),
	notes: text(2000).default(""),
	/** Other people at the client; copied on invoice emails. */
	contacts: z.array(clientContactSchema).max(20).default([]),
});
export type ClientInput = z.input<typeof clientInputSchema>;

export const taxRateInputSchema = z.object({
	name: text(100).min(1, "Name is required"),
	/** Basis points: 20% = 2000. */
	rate: z.int().min(0).max(100_000),
	/** Printed on invoices using this rate, e.g. a VAT exemption notice. */
	note: text(500).default(""),
	isDefault: z.boolean().default(false),
});
export type TaxRateInput = z.input<typeof taxRateInputSchema>;

export const discountSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("percent"), value: z.int().min(0).max(10_000) }),
	z.object({ type: z.literal("amount"), value: z.int().min(0) }),
]);

export const invoiceItemInputSchema = z.object({
	description: text(1000).default(""),
	unit: text(20).default(""),
	/** Integer thousandths: 1.5 → 1500. */
	quantity: z.int().min(-1_000_000_000).max(1_000_000_000),
	/** Minor units of the invoice currency; negative for credits. */
	unitPrice: z.int().min(-1_000_000_000_000).max(1_000_000_000_000),
	taxRateId: idSchema.nullable().default(null),
	/** Basis points copied from the tax rate (or entered ad hoc). */
	taxRate: z.int().min(0).max(100_000).default(0),
});
export type InvoiceItemInput = z.input<typeof invoiceItemInputSchema>;

export const invoiceDraftInputSchema = z.object({
	clientId: idSchema.nullable().default(null),
	paymentAccountId: idSchema.nullable().default(null),
	currency: currencySchema,
	issueDate: isoDateSchema,
	dueDate: isoDateSchema,
	discount: discountSchema.nullable().default(null),
	notes: text(5000).default(""),
	terms: text(5000).default(""),
	items: z.array(invoiceItemInputSchema).max(500).default([]),
});
export type InvoiceDraftInput = z.input<typeof invoiceDraftInputSchema>;
export type InvoiceDraft = z.output<typeof invoiceDraftInputSchema>;

export const paymentInputSchema = z.object({
	/** Minor units of the invoice currency. */
	amount: z.int().min(1, "Enter an amount").max(1_000_000_000_000),
	date: isoDateSchema,
	/** e.g. "Bank transfer"; free text. */
	method: text(50).default(""),
	note: text(500).default(""),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

/** Something you bill often, saved to fill invoice lines in one pick. */
export const catalogItemInputSchema = z.object({
	description: text(1000).min(1, "Description is required"),
	unit: text(20).default(""),
	/** Minor units of `currency`. */
	unitPrice: z.int().min(-1_000_000_000_000).max(1_000_000_000_000),
	currency: currencySchema,
	/** Tax rate picked when the item is added; null = no tax. */
	taxRateId: idSchema.nullable().default(null),
});
export type CatalogItemInput = z.input<typeof catalogItemInputSchema>;
