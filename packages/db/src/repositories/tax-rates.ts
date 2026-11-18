import { type TaxRate, type TaxRateInput, taxRateInputSchema } from "@dawnstudio/core";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { taxRates } from "../schema";
import { notFound, type RepositoryContext } from "./context";

export function taxRateRepository({ db, now, newId }: RepositoryContext) {
	const get = (id: string): TaxRate =>
		db.select().from(taxRates).where(eq(taxRates.id, id)).get() ?? notFound("Tax rate");

	/** At most one active rate is the default: setting one clears the others. */
	const makeOnlyDefault = (id: string) =>
		db
			.update(taxRates)
			.set({ isDefault: false })
			.where(and(ne(taxRates.id, id), eq(taxRates.isDefault, true)))
			.run();

	return {
		get,

		list({ includeArchived = false } = {}): TaxRate[] {
			return db
				.select()
				.from(taxRates)
				.where(includeArchived ? undefined : isNull(taxRates.archivedAt))
				.orderBy(desc(taxRates.isDefault), asc(taxRates.createdAt))
				.all();
		},

		create(input: TaxRateInput): TaxRate {
			return db.transaction(() => {
				const values = taxRateInputSchema.parse(input);
				const { isDefault } = values; // "No tax" is a valid default, so none is forced.
				const timestamp = now();
				const account = db
					.insert(taxRates)
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

		update(id: string, input: TaxRateInput): TaxRate {
			return db.transaction(() => {
				const values = taxRateInputSchema.parse(input);
				const account =
					db
						.update(taxRates)
						.set({ ...values, updatedAt: now() })
						.where(eq(taxRates.id, id))
						.returning()
						.get() ?? notFound("Tax rate");
				if (account.isDefault) makeOnlyDefault(account.id);
				return account;
			});
		},

		archive(id: string): TaxRate {
			return (
				db
					.update(taxRates)
					.set({ archivedAt: now(), isDefault: false, updatedAt: now() })
					.where(eq(taxRates.id, id))
					.returning()
					.get() ?? notFound("Tax rate")
			);
		},
	};
}
