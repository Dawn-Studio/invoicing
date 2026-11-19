import type {
	ClientRevenue,
	DashboardReport,
	InvoiceSummary,
	MonthTotals,
	PeriodReport,
	TaxSummaryRow,
} from "@dawnstudio/core";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { clients, invoiceItems, invoices, payments } from "../schema";
import type { RepositoryContext } from "./context";

/**
 * Read-only figures for the dashboard, reports and exports. Every amount is in one currency:
 * money in different currencies is never added up. "Invoiced" counts issued and paid invoices
 * by issue date (void and drafts excluded); "received" counts payments by the date they arrived.
 */

const BILLED = ["issued", "paid"] as const;

/** "YYYY-MM" months ending with the one `today` falls in, oldest first. */
export function lastMonths(today: string, count: number): string[] {
	const [year = 0, month = 1] = today.split("-").map(Number);
	return Array.from({ length: count }, (_, i) => {
		const date = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
		return date.toISOString().slice(0, 7);
	});
}

export function reportRepository(ctx: RepositoryContext) {
	const { db, today } = ctx;

	const clientName = sql<
		string | null
	>`coalesce(json_extract(${invoices.snapshot}, '$.client.name'), ${clients.name})`;

	/** Currencies with issued invoices, the most used first. */
	const currencies = (): string[] =>
		db
			.select({ currency: invoices.currency, n: sql<number>`count(*)` })
			.from(invoices)
			.where(ne(invoices.status, "draft"))
			.groupBy(invoices.currency)
			.orderBy(desc(sql`count(*)`), asc(invoices.currency))
			.all()
			.map((row) => row.currency);

	/** The requested currency, else the most used one, else the fallback (profile default). */
	const pickCurrency = (all: string[], requested: string | undefined, fallback: string) =>
		requested ?? all[0] ?? fallback;

	const receivedBetween = (currency: string, from: string, to: string) =>
		db
			.select({
				amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
				count: sql<number>`count(distinct ${payments.invoiceId})`,
			})
			.from(payments)
			.innerJoin(invoices, eq(payments.invoiceId, invoices.id))
			.where(and(eq(invoices.currency, currency), gte(payments.date, from), lte(payments.date, to)))
			.get() ?? { amount: 0, count: 0 };

	return {
		currencies,

		dashboard({ currency: requested, fallback }: { currency?: string; fallback: string }) {
			const all = currencies();
			const currency = pickCurrency(all, requested, fallback);
			const date = today();
			const year = date.slice(0, 4);
			const month = date.slice(0, 7);

			const open = db
				.select({
					id: invoices.id,
					number: invoices.number,
					status: invoices.status,
					clientId: invoices.clientId,
					clientName,
					currency: invoices.currency,
					issueDate: invoices.issueDate,
					dueDate: invoices.dueDate,
					total: invoices.total,
					amountPaid: invoices.amountPaid,
					updatedAt: invoices.updatedAt,
				})
				.from(invoices)
				.leftJoin(clients, eq(invoices.clientId, clients.id))
				.where(and(eq(invoices.status, "issued"), eq(invoices.currency, currency)))
				.orderBy(asc(invoices.dueDate))
				.all() satisfies InvoiceSummary[];

			const outstanding = { amount: 0, count: 0 };
			const overdue = { amount: 0, count: 0 };
			for (const invoice of open) {
				const balance = invoice.total - invoice.amountPaid;
				outstanding.amount += balance;
				outstanding.count++;
				if (invoice.dueDate < date) {
					overdue.amount += balance;
					overdue.count++;
				}
			}

			const monthKeys = lastMonths(date, 12);
			const first = `${monthKeys[0]}-01`;
			const byMonth = new Map<string, MonthTotals>(
				monthKeys.map((key) => [key, { month: key, invoiced: 0, received: 0 }]),
			);
			const invoicedRows = db
				.select({
					month: sql<string>`substr(${invoices.issueDate}, 1, 7)`,
					amount: sql<number>`sum(${invoices.total})`,
				})
				.from(invoices)
				.where(
					and(
						inArray(invoices.status, [...BILLED]),
						eq(invoices.currency, currency),
						gte(invoices.issueDate, first),
						lte(invoices.issueDate, date),
					),
				)
				.groupBy(sql`1`)
				.all();
			for (const row of invoicedRows) {
				const entry = byMonth.get(row.month);
				if (entry) entry.invoiced = row.amount;
			}
			const receivedRows = db
				.select({
					month: sql<string>`substr(${payments.date}, 1, 7)`,
					amount: sql<number>`sum(${payments.amount})`,
				})
				.from(payments)
				.innerJoin(invoices, eq(payments.invoiceId, invoices.id))
				.where(
					and(eq(invoices.currency, currency), gte(payments.date, first), lte(payments.date, date)),
				)
				.groupBy(sql`1`)
				.all();
			for (const row of receivedRows) {
				const entry = byMonth.get(row.month);
				if (entry) entry.received = row.amount;
			}

			const drafts = db
				.select({ n: sql<number>`count(*)` })
				.from(invoices)
				.where(eq(invoices.status, "draft"))
				.get();

			return {
				currency,
				currencies: all,
				outstanding,
				overdue,
				receivedThisMonth: receivedBetween(currency, `${month}-01`, `${month}-31`).amount,
				receivedThisYear: receivedBetween(currency, `${year}-01-01`, `${year}-12-31`).amount,
				months: [...byMonth.values()],
				overdueInvoices: open.filter((invoice) => invoice.dueDate < date).slice(0, 5),
				draftCount: drafts?.n ?? 0,
			} satisfies DashboardReport;
		},

		period({
			currency: requested,
			fallback,
			from,
			to,
		}: {
			currency?: string;
			fallback: string;
			from: string;
			to: string;
		}): PeriodReport {
			const all = currencies();
			const currency = pickCurrency(all, requested, fallback);

			const billed = db
				.select({
					id: invoices.id,
					clientId: invoices.clientId,
					clientName,
					total: invoices.total,
					amountPaid: invoices.amountPaid,
					subtotal: invoices.subtotal,
					discountTotal: invoices.discountTotal,
					taxes: invoices.taxes,
					taxTotal: invoices.taxTotal,
				})
				.from(invoices)
				.leftJoin(clients, eq(invoices.clientId, clients.id))
				.where(
					and(
						inArray(invoices.status, [...BILLED]),
						eq(invoices.currency, currency),
						gte(invoices.issueDate, from),
						lte(invoices.issueDate, to),
					),
				)
				.all();

			const clientKey = (id: string | null, name: string | null) => id ?? `name:${name ?? ""}`;
			const byClient = new Map<string, ClientRevenue>();
			const clientEntry = (id: string | null, name: string | null) => {
				const key = clientKey(id, name);
				let entry = byClient.get(key);
				if (!entry) {
					entry = {
						clientId: id,
						name: name ?? "No client",
						invoiceCount: 0,
						invoiced: 0,
						received: 0,
						outstanding: 0,
					};
					byClient.set(key, entry);
				}
				return entry;
			};

			const byRate = new Map<number, TaxSummaryRow>();
			const invoiced = { amount: 0, count: 0 };
			let taxTotal = 0;
			for (const invoice of billed) {
				invoiced.amount += invoice.total;
				invoiced.count++;
				taxTotal += invoice.taxTotal;
				const entry = clientEntry(invoice.clientId, invoice.clientName);
				entry.invoiceCount++;
				entry.invoiced += invoice.total;
				entry.outstanding += invoice.total - invoice.amountPaid;
				// Untaxed lines aren't stored per rate; they're the net the taxed bases don't cover.
				const taxedBase = invoice.taxes.reduce((sum, tax) => sum + tax.base, 0);
				const untaxed = invoice.subtotal - invoice.discountTotal - taxedBase;
				const rates =
					untaxed !== 0 ? [...invoice.taxes, { rate: 0, base: untaxed, amount: 0 }] : invoice.taxes;
				for (const tax of rates) {
					const row = byRate.get(tax.rate) ?? {
						rate: tax.rate,
						base: 0,
						amount: 0,
						invoiceCount: 0,
					};
					row.base += tax.base;
					row.amount += tax.amount;
					row.invoiceCount++;
					byRate.set(tax.rate, row);
				}
			}

			const paid = db
				.select({
					invoiceId: payments.invoiceId,
					clientId: invoices.clientId,
					clientName,
					amount: payments.amount,
				})
				.from(payments)
				.innerJoin(invoices, eq(payments.invoiceId, invoices.id))
				.leftJoin(clients, eq(invoices.clientId, clients.id))
				.where(
					and(eq(invoices.currency, currency), gte(payments.date, from), lte(payments.date, to)),
				)
				.all();
			const paidInvoices = new Set<string>();
			let receivedAmount = 0;
			for (const payment of paid) {
				receivedAmount += payment.amount;
				paidInvoices.add(payment.invoiceId);
				clientEntry(payment.clientId, payment.clientName).received += payment.amount;
			}

			return {
				currency,
				currencies: all,
				from,
				to,
				invoiced,
				received: { amount: receivedAmount, count: paidInvoices.size },
				taxTotal,
				clients: [...byClient.values()].sort(
					(a, b) =>
						b.invoiced - a.invoiced || b.received - a.received || a.name.localeCompare(b.name),
				),
				taxes: [...byRate.values()].sort((a, b) => b.rate - a.rate),
			};
		},

		/** Issued, paid and void invoices issued in the period, with items, for CSV export. */
		invoicesForExport({ from, to }: { from: string; to: string }) {
			const rows = db
				.select({
					id: invoices.id,
					number: invoices.number,
					status: invoices.status,
					clientName,
					currency: invoices.currency,
					issueDate: invoices.issueDate,
					dueDate: invoices.dueDate,
					subtotal: invoices.subtotal,
					discountTotal: invoices.discountTotal,
					taxTotal: invoices.taxTotal,
					total: invoices.total,
					amountPaid: invoices.amountPaid,
					paidAt: invoices.paidAt,
				})
				.from(invoices)
				.leftJoin(clients, eq(invoices.clientId, clients.id))
				.where(
					and(
						ne(invoices.status, "draft"),
						gte(invoices.issueDate, from),
						lte(invoices.issueDate, to),
					),
				)
				.orderBy(asc(invoices.issueDate), asc(invoices.number))
				.all();
			const ids = rows.map((row) => row.id);
			const items =
				ids.length === 0
					? []
					: db
							.select()
							.from(invoiceItems)
							.where(inArray(invoiceItems.invoiceId, ids))
							.orderBy(asc(invoiceItems.position))
							.all();
			return rows.map((row) => ({
				...row,
				items: items.filter((item) => item.invoiceId === row.id),
			}));
		},

		/** Payments dated in the period, with their invoice's number, client and currency. */
		paymentsForExport({ from, to }: { from: string; to: string }) {
			return db
				.select({
					date: payments.date,
					number: invoices.number,
					clientName,
					currency: invoices.currency,
					amount: payments.amount,
					method: payments.method,
					note: payments.note,
				})
				.from(payments)
				.innerJoin(invoices, eq(payments.invoiceId, invoices.id))
				.leftJoin(clients, eq(invoices.clientId, clients.id))
				.where(and(gte(payments.date, from), lte(payments.date, to)))
				.orderBy(asc(payments.date), asc(invoices.number))
				.all();
		},
	};
}

export type ExportInvoice = ReturnType<
	ReturnType<typeof reportRepository>["invoicesForExport"]
>[number];
export type ExportPayment = ReturnType<
	ReturnType<typeof reportRepository>["paymentsForExport"]
>[number];
