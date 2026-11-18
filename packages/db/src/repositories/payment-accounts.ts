import {
	type PaymentAccount,
	type PaymentAccountInput,
	paymentAccountInputSchema,
} from "@dawnstudio/core";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { paymentAccounts } from "../schema";
import { notFound, type RepositoryContext } from "./context";

export function paymentAccountRepository({ db, now, newId }: RepositoryContext) {
	const get = (id: string): PaymentAccount =>
		db.select().from(paymentAccounts).where(eq(paymentAccounts.id, id)).get() ??
		notFound("Payment account");

	const hasDefault = () =>
		db
			.select({ id: paymentAccounts.id })
			.from(paymentAccounts)
			.where(and(eq(paymentAccounts.isDefault, true), isNull(paymentAccounts.archivedAt)))
			.get() !== undefined;

	/** Exactly one active account is the default: setting one clears the others. */
	const makeOnlyDefault = (id: string) =>
		db
			.update(paymentAccounts)
			.set({ isDefault: false })
			.where(and(ne(paymentAccounts.id, id), eq(paymentAccounts.isDefault, true)))
			.run();

	return {
		get,

		list({ includeArchived = false } = {}): PaymentAccount[] {
			return db
				.select()
				.from(paymentAccounts)
				.where(includeArchived ? undefined : isNull(paymentAccounts.archivedAt))
				.orderBy(desc(paymentAccounts.isDefault), asc(paymentAccounts.createdAt))
				.all();
		},

		create(input: PaymentAccountInput): PaymentAccount {
			return db.transaction(() => {
				const values = paymentAccountInputSchema.parse(input);
				const isDefault = values.isDefault || !hasDefault();
				const timestamp = now();
				const account = db
					.insert(paymentAccounts)
					.values({
						...values,
						isDefault,
						id: newId(),
						archivedAt: null,
						createdAt: timestamp,
						updatedAt: timestamp,
					})
					.returning()
					.get();
				if (isDefault) makeOnlyDefault(account.id);
				return account;
			});
		},

		update(id: string, input: PaymentAccountInput): PaymentAccount {
			return db.transaction(() => {
				const values = paymentAccountInputSchema.parse(input);
				const account =
					db
						.update(paymentAccounts)
						.set({ ...values, updatedAt: now() })
						.where(eq(paymentAccounts.id, id))
						.returning()
						.get() ?? notFound("Payment account");
				if (account.isDefault) makeOnlyDefault(account.id);
				return account;
			});
		},

		archive(id: string): PaymentAccount {
			return (
				db
					.update(paymentAccounts)
					.set({ archivedAt: now(), isDefault: false, updatedAt: now() })
					.where(eq(paymentAccounts.id, id))
					.returning()
					.get() ?? notFound("Payment account")
			);
		},
	};
}
