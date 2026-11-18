import {
	type Client,
	type ClientCurrencyTotals,
	type ClientImportResult,
	type ClientInput,
	type ClientStats,
	clientInputSchema,
} from "@dawnstudio/core";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { clients, invoices } from "../schema";
import { likePattern, notFound, type RepositoryContext } from "./context";

export interface ClientListOptions {
	search?: string;
	includeArchived?: boolean;
}

export function clientRepository({ db, now, today, newId }: RepositoryContext) {
	const get = (id: string): Client =>
		db.select().from(clients).where(eq(clients.id, id)).get() ?? notFound("Client");

	const setArchived = (id: string, archivedAt: number | null): Client =>
		db
			.update(clients)
			.set({ archivedAt, updatedAt: now() })
			.where(eq(clients.id, id))
			.returning()
			.get() ?? notFound("Client");

	const insert = (input: ClientInput): Client => {
		const timestamp = now();
		return db
			.insert(clients)
			.values({
				...clientInputSchema.parse(input),
				id: newId(),
				archivedAt: null,
				createdAt: timestamp,
				updatedAt: timestamp,
			})
			.returning()
			.get();
	};

	return {
		get,

		list({ search, includeArchived = false }: ClientListOptions = {}): Client[] {
			const term = search?.trim();
			const pattern = term ? likePattern(term) : null;
			return db
				.select()
				.from(clients)
				.where(
					and(
						includeArchived ? undefined : isNull(clients.archivedAt),
						pattern
							? or(
									sql`${clients.name} LIKE ${pattern} ESCAPE '\\'`,
									sql`${clients.contactName} LIKE ${pattern} ESCAPE '\\'`,
									sql`${clients.email} LIKE ${pattern} ESCAPE '\\'`,
								)
							: undefined,
					),
				)
				.orderBy(asc(sql`${clients.name} COLLATE NOCASE`))
				.all();
		},

		create: (input: ClientInput) => insert(input),

		/** Adds many clients at once (CSV import), skipping names that already exist. */
		importMany(inputs: ClientInput[]): ClientImportResult {
			const parsed = inputs.map((input) => clientInputSchema.parse(input));
			return db.transaction(() => {
				const existing = new Set(
					db
						.select({ name: clients.name })
						.from(clients)
						.all()
						.map((row) => row.name.toLowerCase()),
				);
				const result: ClientImportResult = { created: 0, skipped: [] };
				for (const client of parsed) {
					const key = client.name.toLowerCase();
					if (existing.has(key)) {
						result.skipped.push(client.name);
						continue;
					}
					existing.add(key);
					insert(client);
					result.created++;
				}
				return result;
			});
		},

		/** What the client has been billed and still owes, per currency. */
		stats(id: string): ClientStats {
			get(id);
			const rows = db
				.select({
					status: invoices.status,
					currency: invoices.currency,
					total: invoices.total,
					issueDate: invoices.issueDate,
					dueDate: invoices.dueDate,
				})
				.from(invoices)
				.where(eq(invoices.clientId, id))
				.all();
			const date = today();
			const totals = new Map<string, ClientCurrencyTotals>();
			let invoiceCount = 0;
			let draftCount = 0;
			let lastIssueDate: string | null = null;
			for (const row of rows) {
				if (row.status === "draft") {
					draftCount++;
					continue;
				}
				invoiceCount++;
				if (!lastIssueDate || row.issueDate > lastIssueDate) lastIssueDate = row.issueDate;
				if (row.status === "void") continue;
				const entry = totals.get(row.currency) ?? {
					currency: row.currency,
					billed: 0,
					paid: 0,
					outstanding: 0,
					overdue: 0,
				};
				entry.billed += row.total;
				if (row.status === "paid") entry.paid += row.total;
				else {
					entry.outstanding += row.total;
					if (row.dueDate < date) entry.overdue += row.total;
				}
				totals.set(row.currency, entry);
			}
			return {
				invoiceCount,
				draftCount,
				lastIssueDate,
				// Largest outstanding first, then largest billed.
				totals: [...totals.values()].sort(
					(a, b) => b.outstanding - a.outstanding || b.billed - a.billed,
				),
			};
		},

		update(id: string, input: ClientInput): Client {
			return (
				db
					.update(clients)
					.set({ ...clientInputSchema.parse(input), updatedAt: now() })
					.where(eq(clients.id, id))
					.returning()
					.get() ?? notFound("Client")
			);
		},

		/** Clients are archived, never deleted: issued invoices keep referring to them. */
		archive: (id: string) => setArchived(id, now()),
		unarchive: (id: string) => setArchived(id, null),
	};
}
