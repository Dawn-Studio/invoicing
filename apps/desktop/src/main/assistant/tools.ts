import {
	addDays,
	type Client,
	DomainError,
	formatMoney,
	formatQuantity,
	formatRate,
	fromMinor,
	INVOICE_STATUSES,
	type Invoice,
	type InvoiceDraftInput,
	isCurrencyCode,
	parseQuantity,
	toMinor,
} from "@dawnstudio/core";
import type { Repositories } from "@dawnstudio/db";
import { type ToolSet, tool } from "ai";
import { z } from "zod";

/**
 * What the assistant can do. Every tool goes through the same repositories as the UI, so
 * the model gets the same rules (numbering, totals, locked issued invoices). Reads run on
 * their own; anything that changes data waits for the user's approval (see WRITE_TOOLS), and
 * issuing, sending, payments and deleting aren't tools at all.
 */

const id = z.string().min(1).max(64);
const isoDate = z.iso.date().describe("YYYY-MM-DD");
/** Amounts travel as decimal strings in the invoice currency, never floats. */
const amount = z
	.string()
	.regex(/^-?\d+(\.\d+)?$/, "A plain decimal like 1250 or 99.50")
	.describe('Decimal amount in major units as a string, e.g. "1250" or "99.50"');
const currency = z
	.string()
	.length(3)
	.transform((code) => code.toUpperCase())
	.refine(isCurrencyCode, "An ISO 4217 code like EUR")
	.describe("ISO 4217 code, e.g. EUR");

const lineSchema = z.object({
	description: z.string().max(1000),
	quantity: z
		.string()
		.regex(/^-?\d+(\.\d{1,3})?$/)
		.describe('Quantity as a decimal string, up to 3 decimals, e.g. "12" or "1.5"'),
	unitPrice: amount,
	unit: z.string().max(20).optional().describe('e.g. "h", "day", "pcs"; empty for none'),
	taxRateId: id.optional().describe("Id from listTaxRates; omit for no tax"),
});
type LineInput = z.infer<typeof lineSchema>;

/** "€5,340.00": read by the model and shown in the app's step log. */
const money = (value: number, code: string) => formatMoney(value, code, "en");

function clientView(client: Client) {
	return {
		id: client.id,
		name: client.name,
		contactName: client.contactName || undefined,
		email: client.email || undefined,
		currency: client.currency ?? undefined,
		paymentTermsDays: client.paymentTermsDays ?? undefined,
		city: client.address.city || undefined,
		country: client.address.country || undefined,
		archived: client.archivedAt !== null || undefined,
	};
}

function invoiceView(invoice: Invoice, clientName: string | null) {
	const code = invoice.currency;
	return {
		id: invoice.id,
		number: invoice.number,
		status: invoice.status,
		client: clientName,
		clientId: invoice.clientId,
		currency: code,
		issueDate: invoice.issueDate,
		dueDate: invoice.dueDate,
		items: invoice.items.map((item) => ({
			description: item.description,
			quantity: formatQuantity(item.quantity),
			unit: item.unit || undefined,
			unitPrice: fromMinor(item.unitPrice, code),
			tax: item.taxRate ? `${formatRate(item.taxRate)}%` : undefined,
			taxRateId: item.taxRateId ?? undefined,
		})),
		subtotal: money(invoice.subtotal, code),
		tax: money(invoice.taxTotal, code),
		total: money(invoice.total, code),
		paid: money(invoice.amountPaid, code),
		balance: money(invoice.total - invoice.amountPaid, code),
		notes: invoice.notes || undefined,
	};
}

/** Draft lines from the model's decimal strings, with tax rates looked up by id. */
function toItems(repos: Repositories, lines: LineInput[], code: string) {
	return lines.map((line) => {
		const rate = line.taxRateId ? repos.taxRates.get(line.taxRateId) : null;
		return {
			description: line.description,
			unit: line.unit ?? "",
			quantity: parseQuantity(line.quantity),
			unitPrice: toMinor(line.unitPrice, code),
			taxRateId: rate?.id ?? null,
			taxRate: rate?.rate ?? 0,
		};
	});
}

/** The editable fields of a draft, as `updateDraft` wants them. */
function draftInput(invoice: Invoice): InvoiceDraftInput {
	return {
		clientId: invoice.clientId,
		paymentAccountId: invoice.paymentAccountId,
		currency: invoice.currency,
		issueDate: invoice.issueDate,
		dueDate: invoice.dueDate,
		discount: invoice.discount,
		notes: invoice.notes,
		terms: invoice.terms,
		items: invoice.items.map(({ id: _id, position: _position, ...item }) => item),
	};
}

const draftFields = {
	clientId: id.nullable().optional().describe("Client id from searchClients"),
	currency: currency.optional().describe("Defaults to the client's or the business currency"),
	issueDate: isoDate.optional(),
	dueDate: isoDate.optional().describe("Defaults to the client's or business payment terms"),
	notes: z.string().max(5000).optional().describe("Printed on the invoice"),
};

/** Tools that change data; each waits for the user to approve its exact input. */
export const WRITE_TOOLS = [
	"createClient",
	"createDraftInvoice",
	"updateDraftInvoice",
	"addCatalogItem",
] as const;

export function createTools(repos: () => Repositories) {
	const clientName = (clientId: string | null) => {
		if (!clientId) return null;
		try {
			return repos().clients.get(clientId).name;
		} catch {
			return null;
		}
	};

	return {
		getBusinessProfile: tool({
			description:
				"The user's own business: name, default currency, payment terms and invoice numbering.",
			inputSchema: z.object({}),
			execute: () => {
				const profile = repos().profile.get();
				if (!profile) return { error: "No business profile yet" };
				return {
					name: profile.name,
					legalName: profile.legalName || undefined,
					email: profile.email || undefined,
					defaultCurrency: profile.defaultCurrency,
					paymentTermsDays: profile.paymentTermsDays,
					country: profile.address.country || undefined,
				};
			},
		}),

		searchClients: tool({
			description:
				"Find clients by name, contact or email. Empty query lists recent clients. Use before creating a client to avoid duplicates.",
			inputSchema: z.object({
				query: z.string().max(200).optional(),
				includeArchived: z.boolean().optional(),
			}),
			execute: ({ query, includeArchived }) =>
				repos().clients.list({ search: query, includeArchived }).slice(0, 25).map(clientView),
		}),

		getClient: tool({
			description: "Full details of one client, with what they've been invoiced and paid.",
			inputSchema: z.object({ id }),
			execute: ({ id: clientId }) => {
				const client = repos().clients.get(clientId);
				const stats = repos().clients.stats(clientId);
				return {
					...clientView(client),
					address: client.address,
					taxId: client.taxId,
					notes: client.notes,
					stats,
				};
			},
		}),

		searchInvoices: tool({
			description:
				"List invoices, newest first. Filter by status, client, currency, issue date range or text (number, client).",
			inputSchema: z.object({
				status: z.array(z.enum(INVOICE_STATUSES)).optional(),
				clientId: id.optional(),
				currency: currency.optional(),
				from: isoDate.optional(),
				to: isoDate.optional(),
				query: z.string().max(200).optional(),
			}),
			execute: ({ query, ...filters }) =>
				repos()
					.invoices.list({ ...filters, search: query })
					.slice(0, 30)
					.map((invoice) => ({
						id: invoice.id,
						number: invoice.number ?? "Draft",
						status: invoice.status,
						client: invoice.clientName,
						issueDate: invoice.issueDate,
						dueDate: invoice.dueDate,
						total: money(invoice.total, invoice.currency),
						balance: money(invoice.total - invoice.amountPaid, invoice.currency),
					})),
		}),

		getInvoice: tool({
			description: "One invoice with its lines, totals and payments.",
			inputSchema: z.object({ id }),
			execute: ({ id: invoiceId }) => {
				const invoice = repos().invoices.get(invoiceId);
				return invoiceView(invoice, clientName(invoice.clientId));
			},
		}),

		searchCatalog: tool({
			description: "Saved items (services and products) with their usual price and unit.",
			inputSchema: z.object({ query: z.string().max(200).optional() }),
			execute: ({ query }) =>
				repos()
					.catalog.list({ search: query })
					.slice(0, 30)
					.map((item) => ({
						id: item.id,
						description: item.description,
						unit: item.unit || undefined,
						unitPrice: money(item.unitPrice, item.currency),
						taxRateId: item.taxRateId ?? undefined,
					})),
		}),

		listTaxRates: tool({
			description: "The tax rates lines can use; pass a rate's id as a line's taxRateId.",
			inputSchema: z.object({}),
			execute: () =>
				repos()
					.taxRates.list()
					.map((rate) => ({
						id: rate.id,
						name: rate.name,
						rate: `${formatRate(rate.rate)}%`,
						isDefault: rate.isDefault,
					})),
		}),

		getReport: tool({
			description:
				"Totals for a period in one currency: invoiced, received, revenue per client and tax per rate.",
			inputSchema: z.object({ from: isoDate, to: isoDate, currency: currency.optional() }),
			execute: ({ from, to, currency: code }) => {
				const fallback = repos().profile.get()?.defaultCurrency ?? "USD";
				return repos().reports.period({ from, to, currency: code, fallback });
			},
		}),

		createClient: tool({
			description:
				"Add a client. The user reviews and approves it first. Search first so you don't create a duplicate.",
			inputSchema: z.object({
				name: z.string().min(1).max(200),
				contactName: z.string().max(200).optional(),
				email: z.email().optional(),
				phone: z.string().max(50).optional(),
				taxId: z.string().max(50).optional(),
				currency: currency.optional(),
				paymentTermsDays: z.int().min(0).max(365).optional(),
				address: z
					.object({
						line1: z.string().max(200).optional(),
						line2: z.string().max(200).optional(),
						city: z.string().max(100).optional(),
						region: z.string().max(100).optional(),
						postalCode: z.string().max(20).optional(),
						country: z.string().max(100).optional(),
					})
					.optional(),
				notes: z.string().max(2000).optional(),
			}),
			execute: (input) => {
				const client = repos().clients.create(input);
				return { id: client.id, name: client.name };
			},
		}),

		createDraftInvoice: tool({
			description:
				"Create a draft invoice with lines. The user reviews and approves it first, then edits and issues it themselves.",
			inputSchema: z.object({
				...draftFields,
				items: z.array(lineSchema).min(1).max(100),
			}),
			execute: ({ clientId, currency: code, issueDate, dueDate, notes, items }) => {
				const draft = repos().invoices.createDraft({ clientId: clientId ?? null });
				const finalCurrency = code ?? draft.currency;
				const start = issueDate ?? draft.issueDate;
				const termsDays = Math.max(
					0,
					(Date.parse(draft.dueDate) - Date.parse(draft.issueDate)) / 86_400_000,
				);
				const invoice = repos().invoices.updateDraft(draft.id, {
					...draftInput(draft),
					currency: finalCurrency,
					issueDate: start,
					dueDate: dueDate ?? addDays(start, termsDays),
					notes: notes ?? draft.notes,
					items: toItems(repos(), items, finalCurrency),
				});
				return {
					invoiceId: invoice.id,
					client: clientName(invoice.clientId),
					total: money(invoice.total, invoice.currency),
				};
			},
		}),

		updateDraftInvoice: tool({
			description:
				"Change a draft invoice. Only drafts can change. `items`, when given, replaces all lines. The user approves first.",
			inputSchema: z.object({
				id,
				...draftFields,
				items: z.array(lineSchema).max(100).optional(),
			}),
			execute: ({ id: invoiceId, clientId, currency: code, issueDate, dueDate, notes, items }) => {
				const current = repos().invoices.get(invoiceId);
				if (current.status !== "draft") {
					throw new DomainError("CONFLICT", "Only drafts can be changed");
				}
				const finalCurrency = code ?? current.currency;
				const invoice = repos().invoices.updateDraft(invoiceId, {
					...draftInput(current),
					...(clientId !== undefined ? { clientId } : {}),
					currency: finalCurrency,
					issueDate: issueDate ?? current.issueDate,
					dueDate: dueDate ?? current.dueDate,
					notes: notes ?? current.notes,
					...(items ? { items: toItems(repos(), items, finalCurrency) } : {}),
				});
				return { invoiceId: invoice.id, total: money(invoice.total, invoice.currency) };
			},
		}),

		addCatalogItem: tool({
			description: "Save a service or product for reuse. The user approves first.",
			inputSchema: z.object({
				description: z.string().min(1).max(1000),
				unitPrice: amount,
				currency,
				unit: z.string().max(20).optional(),
				taxRateId: id.optional(),
			}),
			execute: ({ unitPrice, ...input }) => {
				const item = repos().catalog.create({
					...input,
					unitPrice: toMinor(unitPrice, input.currency),
				});
				return { id: item.id, description: item.description };
			},
		}),
	} satisfies ToolSet;
}

export type AssistantTools = ReturnType<typeof createTools>;

/**
 * The current data of a record the user @-mentioned or is looking at, for the model.
 * Null when it no longer exists (deleted or another workspace).
 */
export function describeRecord(
	repos: Repositories,
	{ type, id: recordId }: { type: "client" | "invoice" | "item"; id: string },
): Record<string, unknown> | null {
	try {
		if (type === "client") return clientView(repos.clients.get(recordId));
		if (type === "invoice") {
			const invoice = repos.invoices.get(recordId);
			const client = invoice.clientId ? repos.clients.get(invoice.clientId) : null;
			return invoiceView(invoice, client?.name ?? null);
		}
		const item = repos.catalog.get(recordId);
		return {
			id: item.id,
			description: item.description,
			unit: item.unit || undefined,
			unitPrice: money(item.unitPrice, item.currency),
			taxRateId: item.taxRateId ?? undefined,
		};
	} catch {
		return null;
	}
}
