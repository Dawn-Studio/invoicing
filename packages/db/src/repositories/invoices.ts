import {
	addDays,
	buildSnapshot,
	computeTotals,
	DomainError,
	formatInvoiceNumber,
	type Invoice,
	type InvoiceDraftInput,
	type InvoiceEvent,
	type InvoiceEventType,
	type InvoiceItem,
	type InvoiceStatus,
	type InvoiceSummary,
	invoiceDraftInputSchema,
	type Payment,
	type PaymentInput,
	paymentInputSchema,
} from "@dawnstudio/core";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { clients, invoiceEvents, invoiceItems, invoices, payments, taxRates } from "../schema";
import { clientRepository } from "./clients";
import { likePattern, notFound, type RepositoryContext } from "./context";
import { paymentAccountRepository } from "./payment-accounts";
import { profileRepository } from "./profile";

export interface InvoiceListOptions {
	status?: InvoiceStatus[];
	clientId?: string;
	/** Matches invoice number or client name. */
	search?: string;
}

/**
 * Invoice lifecycle: draft → issued → paid, or issued → void.
 * Only drafts can be edited or deleted. Issuing assigns the number and freezes a snapshot.
 */
export function invoiceRepository(ctx: RepositoryContext) {
	const { db, now, today, newId } = ctx;
	const profiles = profileRepository(ctx);
	const clientRepo = clientRepository(ctx);
	const accounts = paymentAccountRepository(ctx);

	const findRow = (id: string) =>
		db.select().from(invoices).where(eq(invoices.id, id)).get() ?? notFound("Invoice");

	const itemsOf = (invoiceId: string): InvoiceItem[] =>
		db
			.select()
			.from(invoiceItems)
			.where(eq(invoiceItems.invoiceId, invoiceId))
			.orderBy(asc(invoiceItems.position))
			.all()
			.map(({ invoiceId: _, ...item }) => item);

	const get = (id: string): Invoice => ({ ...findRow(id), items: itemsOf(id) });

	const recordEvent = (
		invoiceId: string,
		type: InvoiceEventType,
		payload: Record<string, unknown> = {},
	) =>
		db
			.insert(invoiceEvents)
			.values({ id: newId(), invoiceId, type, payload, createdAt: now() })
			.run();

	const requireStatus = (id: string, allowed: InvoiceStatus[], action: string) => {
		const row = findRow(id);
		if (!allowed.includes(row.status)) {
			throw new DomainError("INVALID_STATE", `Can't ${action} an invoice that is ${row.status}`);
		}
		return row;
	};

	/** Writes draft fields and items, recomputing the stored totals. */
	const writeDraft = (id: string, input: InvoiceDraftInput) => {
		const draft = invoiceDraftInputSchema.parse(input);
		if (draft.clientId) clientRepo.get(draft.clientId);
		if (draft.paymentAccountId) accounts.get(draft.paymentAccountId);
		const totals = computeTotals(draft.items, draft.discount);
		const { items, ...fields } = draft;

		db.update(invoices)
			.set({
				...fields,
				subtotal: totals.subtotal,
				discountTotal: totals.discountTotal,
				taxes: totals.taxes,
				taxTotal: totals.taxTotal,
				total: totals.total,
				updatedAt: now(),
			})
			.where(eq(invoices.id, id))
			.run();
		db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
		if (items.length > 0) {
			db.insert(invoiceItems)
				.values(items.map((item, position) => ({ ...item, id: newId(), invoiceId: id, position })))
				.run();
		}
	};

	const insertDraft = (input: InvoiceDraftInput): Invoice => {
		const id = newId();
		const timestamp = now();
		db.insert(invoices)
			.values({
				id,
				status: "draft",
				currency: input.currency,
				issueDate: input.issueDate,
				dueDate: input.dueDate,
				taxes: [],
				createdAt: timestamp,
				updatedAt: timestamp,
			})
			.run();
		writeDraft(id, input);
		recordEvent(id, "created");
		return get(id);
	};

	return {
		get,

		list({ status, clientId, search }: InvoiceListOptions = {}): InvoiceSummary[] {
			const term = search?.trim();
			const pattern = term ? likePattern(term) : null;
			const rows = db
				.select({
					id: invoices.id,
					number: invoices.number,
					status: invoices.status,
					clientId: invoices.clientId,
					currentClientName: clients.name,
					snapshot: invoices.snapshot,
					currency: invoices.currency,
					issueDate: invoices.issueDate,
					dueDate: invoices.dueDate,
					total: invoices.total,
					amountPaid: invoices.amountPaid,
					updatedAt: invoices.updatedAt,
				})
				.from(invoices)
				.leftJoin(clients, eq(invoices.clientId, clients.id))
				.where(
					and(
						status && status.length > 0 ? inArray(invoices.status, status) : undefined,
						clientId ? eq(invoices.clientId, clientId) : undefined,
						pattern
							? or(
									sql`${invoices.number} LIKE ${pattern} ESCAPE '\\'`,
									sql`${clients.name} LIKE ${pattern} ESCAPE '\\'`,
								)
							: undefined,
					),
				)
				.orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
				.all();
			// Issued invoices show the client name as it was printed, not as it is now.
			return rows.map(({ snapshot, currentClientName, ...row }) => ({
				...row,
				clientName: snapshot?.client.name ?? currentClientName,
			}));
		},

		/** Starts a draft with sensible defaults taken from the client and business profile. */
		createDraft({ clientId = null }: { clientId?: string | null } = {}): Invoice {
			return db.transaction(() => {
				const profile = profiles.get();
				const client = clientId ? clientRepo.get(clientId) : null;
				const currency = client?.currency ?? profile?.defaultCurrency ?? "USD";
				const terms = client?.paymentTermsDays ?? profile?.paymentTermsDays ?? 14;
				const account =
					accounts.list().find((a) => a.isDefault && a.currency === currency) ??
					accounts.list().find((a) => a.currency === currency) ??
					null;
				const issueDate = today();
				return insertDraft({
					clientId,
					paymentAccountId: account?.id ?? null,
					currency,
					issueDate,
					dueDate: addDays(issueDate, terms),
				});
			});
		},

		updateDraft(id: string, input: InvoiceDraftInput): Invoice {
			return db.transaction(() => {
				requireStatus(id, ["draft"], "edit");
				writeDraft(id, input);
				return get(id);
			});
		},

		deleteDraft(id: string): void {
			db.transaction(() => {
				requireStatus(id, ["draft"], "delete");
				db.delete(invoices).where(eq(invoices.id, id)).run();
			});
		},

		/** Copies an invoice (any status) into a new draft dated today. */
		duplicate(id: string): Invoice {
			return db.transaction(() => {
				const source = get(id);
				const issueDate = today();
				const termDays = Math.max(
					0,
					Math.round((Date.parse(source.dueDate) - Date.parse(source.issueDate)) / 86_400_000),
				);
				return insertDraft({
					clientId: source.clientId,
					paymentAccountId: source.paymentAccountId,
					currency: source.currency,
					issueDate,
					dueDate: addDays(issueDate, termDays),
					discount: source.discount,
					notes: source.notes,
					terms: source.terms,
					items: source.items.map(({ id: _, position: __, ...item }) => item),
				});
			});
		},

		/** Assigns the next number, freezes the snapshot and locks the invoice. */
		issue(id: string): Invoice {
			return db.transaction(() => {
				const row = requireStatus(id, ["draft"], "issue");
				const profile = profiles.get();
				if (!profile)
					throw new DomainError("VALIDATION", "Set up your business profile before issuing");

				const items = itemsOf(id);
				const rateIds = [
					...new Set(items.flatMap((item) => (item.taxRateId ? [item.taxRateId] : []))),
				];
				const taxNotes =
					rateIds.length > 0
						? db
								.select({ note: taxRates.note })
								.from(taxRates)
								.where(inArray(taxRates.id, rateIds))
								.all()
								.map((rate) => rate.note)
						: [];

				const number = formatInvoiceNumber(
					profile.numberPattern,
					profile.nextSequence,
					row.issueDate,
				);
				if (
					db.select({ id: invoices.id }).from(invoices).where(eq(invoices.number, number)).get()
				) {
					throw new DomainError(
						"CONFLICT",
						`Invoice number ${number} is already used. Change the next number in settings.`,
					);
				}

				const snapshot = buildSnapshot({
					...row,
					number,
					items,
					profile,
					client: row.clientId ? clientRepo.get(row.clientId) : null,
					paymentAccount: row.paymentAccountId ? accounts.get(row.paymentAccountId) : null,
					taxNotes,
				});
				const timestamp = now();
				db.update(invoices)
					.set({
						status: "issued",
						number,
						snapshot,
						...snapshot.totals,
						issuedAt: timestamp,
						updatedAt: timestamp,
					})
					.where(eq(invoices.id, id))
					.run();
				profiles.save({ ...profile, nextSequence: profile.nextSequence + 1 });
				recordEvent(id, "issued", { number });
				return get(id);
			});
		},

		payments(invoiceId: string): Payment[] {
			return db
				.select()
				.from(payments)
				.where(eq(payments.invoiceId, invoiceId))
				.orderBy(asc(payments.date), asc(payments.createdAt))
				.all();
		},

		/**
		 * Records money received. A payment that settles the balance marks the invoice paid;
		 * smaller ones leave it open with less due. Overpaying is refused.
		 */
		recordPayment(invoiceId: string, input: PaymentInput): Invoice {
			const payment = paymentInputSchema.parse(input);
			return db.transaction(() => {
				const row = requireStatus(invoiceId, ["issued"], "record a payment on");
				const balance = row.total - row.amountPaid;
				if (payment.amount > balance) {
					throw new DomainError("VALIDATION", "That's more than the balance due");
				}
				if (payment.date < row.issueDate) {
					throw new DomainError("VALIDATION", "Payment date can't be before the issue date");
				}
				const timestamp = now();
				db.insert(payments)
					.values({ ...payment, id: newId(), invoiceId, createdAt: timestamp })
					.run();
				recordEvent(invoiceId, "payment", {
					amount: payment.amount,
					date: payment.date,
					method: payment.method,
				});
				const amountPaid = row.amountPaid + payment.amount;
				const settled = amountPaid >= row.total;
				db.update(invoices)
					.set({
						amountPaid,
						...(settled ? { status: "paid" as const, paidAt: timestamp } : {}),
						updatedAt: timestamp,
					})
					.where(eq(invoices.id, invoiceId))
					.run();
				if (settled) recordEvent(invoiceId, "paid");
				return get(invoiceId);
			});
		},

		/** Removes a payment recorded by mistake; a paid invoice becomes open again. */
		removePayment(paymentId: string): Invoice {
			return db.transaction(() => {
				const payment =
					db.select().from(payments).where(eq(payments.id, paymentId)).get() ?? notFound("Payment");
				const row = requireStatus(payment.invoiceId, ["issued", "paid"], "change payments on");
				db.delete(payments).where(eq(payments.id, paymentId)).run();
				recordEvent(row.id, "paymentRemoved", { amount: payment.amount, date: payment.date });
				const timestamp = now();
				db.update(invoices)
					.set({
						amountPaid: row.amountPaid - payment.amount,
						status: "issued",
						paidAt: null,
						updatedAt: timestamp,
					})
					.where(eq(invoices.id, row.id))
					.run();
				if (row.status === "paid") recordEvent(row.id, "unpaid");
				return get(row.id);
			});
		},

		/** Shortcut: one payment for the whole balance, dated today. */
		markPaid(id: string): Invoice {
			const row = requireStatus(id, ["issued"], "mark as paid");
			return this.recordPayment(id, { amount: row.total - row.amountPaid, date: today() });
		},

		/** Voided invoices keep their number and snapshot; the number is never reused. */
		void(id: string, reason = ""): Invoice {
			return db.transaction(() => {
				const row = requireStatus(id, ["issued"], "void");
				if (row.amountPaid > 0) {
					throw new DomainError(
						"INVALID_STATE",
						"This invoice has payments. Remove them before voiding it.",
					);
				}
				const timestamp = now();
				db.update(invoices)
					.set({ status: "void", voidedAt: timestamp, updatedAt: timestamp })
					.where(eq(invoices.id, id))
					.run();
				recordEvent(id, "voided", reason ? { reason } : {});
				return get(id);
			});
		},

		events(invoiceId: string): InvoiceEvent[] {
			return db
				.select()
				.from(invoiceEvents)
				.where(eq(invoiceEvents.invoiceId, invoiceId))
				.orderBy(asc(invoiceEvents.createdAt))
				.all() as InvoiceEvent[];
		},
	};
}
