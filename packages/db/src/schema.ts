import type {
	Address,
	Branding,
	ClientContact,
	Discount,
	InvoiceSnapshot,
	InvoiceStatus,
	PaymentDetail,
	TaxTotal,
} from "@dawnstudio/core";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Column names are snake_case in SQLite (`casing: "snake_case"`); timestamps are Unix ms,
// calendar dates are "YYYY-MM-DD" text, money is integer minor units.

const timestamps = {
	createdAt: integer().notNull(),
	updatedAt: integer().notNull(),
};

export const businessProfiles = sqliteTable("business_profiles", {
	id: text().primaryKey(),
	name: text().notNull(),
	legalName: text().notNull().default(""),
	email: text().notNull().default(""),
	phone: text().notNull().default(""),
	website: text().notNull().default(""),
	address: text({ mode: "json" }).$type<Address>().notNull(),
	taxId: text().notNull().default(""),
	logoFile: text(),
	defaultCurrency: text().notNull(),
	paymentTermsDays: integer().notNull(),
	numberPattern: text().notNull(),
	nextSequence: integer().notNull(),
	branding: text({ mode: "json" }).$type<Branding>().notNull(),
	...timestamps,
});

export const paymentAccounts = sqliteTable("payment_accounts", {
	id: text().primaryKey(),
	label: text().notNull(),
	currency: text().notNull(),
	details: text({ mode: "json" }).$type<PaymentDetail[]>().notNull(),
	isDefault: integer({ mode: "boolean" }).notNull().default(false),
	archivedAt: integer(),
	...timestamps,
});

export const clients = sqliteTable("clients", {
	id: text().primaryKey(),
	name: text().notNull(),
	contactName: text().notNull().default(""),
	email: text().notNull().default(""),
	phone: text().notNull().default(""),
	address: text({ mode: "json" }).$type<Address>().notNull(),
	taxId: text().notNull().default(""),
	currency: text(),
	paymentTermsDays: integer(),
	notes: text().notNull().default(""),
	contacts: text({ mode: "json" }).$type<ClientContact[]>().notNull().default([]),
	archivedAt: integer(),
	...timestamps,
});

export const taxRates = sqliteTable("tax_rates", {
	id: text().primaryKey(),
	name: text().notNull(),
	rate: integer().notNull(),
	note: text().notNull().default(""),
	isDefault: integer({ mode: "boolean" }).notNull().default(false),
	archivedAt: integer(),
	...timestamps,
});

export const catalogItems = sqliteTable("catalog_items", {
	id: text().primaryKey(),
	description: text().notNull(),
	unit: text().notNull().default(""),
	unitPrice: integer().notNull(),
	currency: text().notNull(),
	taxRateId: text().references(() => taxRates.id, { onDelete: "set null" }),
	archivedAt: integer(),
	...timestamps,
});

export const invoices = sqliteTable(
	"invoices",
	{
		id: text().primaryKey(),
		number: text().unique(),
		status: text().$type<InvoiceStatus>().notNull(),
		clientId: text().references(() => clients.id, { onDelete: "restrict" }),
		paymentAccountId: text().references(() => paymentAccounts.id, { onDelete: "restrict" }),
		currency: text().notNull(),
		issueDate: text().notNull(),
		dueDate: text().notNull(),
		discount: text({ mode: "json" }).$type<Discount>(),
		notes: text().notNull().default(""),
		terms: text().notNull().default(""),
		subtotal: integer().notNull().default(0),
		discountTotal: integer().notNull().default(0),
		taxes: text({ mode: "json" }).$type<TaxTotal[]>().notNull(),
		taxTotal: integer().notNull().default(0),
		total: integer().notNull().default(0),
		snapshot: text({ mode: "json" }).$type<InvoiceSnapshot>(),
		issuedAt: integer(),
		/** Sum of the invoice's payments, kept in step with the `payments` table. */
		amountPaid: integer().notNull().default(0),
		/** When the balance reached zero. */
		paidAt: integer(),
		voidedAt: integer(),
		...timestamps,
	},
	(t) => [
		index("invoices_status_idx").on(t.status),
		index("invoices_client_idx").on(t.clientId),
		index("invoices_issue_date_idx").on(t.issueDate),
	],
);

export const invoiceItems = sqliteTable(
	"invoice_items",
	{
		id: text().primaryKey(),
		invoiceId: text()
			.notNull()
			.references(() => invoices.id, { onDelete: "cascade" }),
		position: integer().notNull(),
		description: text().notNull().default(""),
		unit: text().notNull().default(""),
		quantity: integer().notNull(),
		unitPrice: integer().notNull(),
		taxRateId: text().references(() => taxRates.id, { onDelete: "set null" }),
		taxRate: integer().notNull().default(0),
	},
	(t) => [index("invoice_items_invoice_idx").on(t.invoiceId, t.position)],
);

export const payments = sqliteTable(
	"payments",
	{
		id: text().primaryKey(),
		invoiceId: text()
			.notNull()
			.references(() => invoices.id, { onDelete: "cascade" }),
		/** Minor units of the invoice currency. */
		amount: integer().notNull(),
		/** When the money arrived (ISO date). */
		date: text().notNull(),
		method: text().notNull().default(""),
		note: text().notNull().default(""),
		createdAt: integer().notNull(),
	},
	(t) => [index("payments_invoice_idx").on(t.invoiceId, t.date)],
);

export const invoiceEvents = sqliteTable(
	"invoice_events",
	{
		id: text().primaryKey(),
		invoiceId: text()
			.notNull()
			.references(() => invoices.id, { onDelete: "cascade" }),
		type: text().notNull(),
		payload: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
		createdAt: integer().notNull(),
	},
	(t) => [index("invoice_events_invoice_idx").on(t.invoiceId, t.createdAt)],
);

export const settings = sqliteTable("settings", {
	key: text().primaryKey(),
	value: text({ mode: "json" }).$type<unknown>().notNull(),
	updatedAt: integer().notNull(),
});

/**
 * Assistant conversations. `messages` holds the AI SDK's UI messages as they were shown;
 * attachments inside them point at files in the app's attachment folder, not inline data.
 */
export const assistantChats = sqliteTable(
	"assistant_chats",
	{
		id: text().primaryKey(),
		title: text().notNull().default(""),
		messages: text({ mode: "json" }).$type<unknown[]>().notNull(),
		...timestamps,
	},
	(t) => [index("assistant_chats_updated_idx").on(t.updatedAt)],
);
