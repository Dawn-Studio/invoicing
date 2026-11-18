import { type CatalogItem, type CatalogItemInput, catalogItemInputSchema } from "@dawnstudio/core";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { catalogItems } from "../schema";
import { likePattern, notFound, type RepositoryContext } from "./context";
import { taxRateRepository } from "./tax-rates";

export interface CatalogListOptions {
	search?: string;
	includeArchived?: boolean;
}

/** Saved items: services and products with a default unit, rate and tax. */
export function catalogRepository(ctx: RepositoryContext) {
	const { db, now, newId } = ctx;
	const taxRates = taxRateRepository(ctx);

	const get = (id: string): CatalogItem =>
		db.select().from(catalogItems).where(eq(catalogItems.id, id)).get() ?? notFound("Item");

	const parse = (input: CatalogItemInput) => {
		const values = catalogItemInputSchema.parse(input);
		if (values.taxRateId) taxRates.get(values.taxRateId);
		return values;
	};

	const setArchived = (id: string, archivedAt: number | null) =>
		db
			.update(catalogItems)
			.set({ archivedAt, updatedAt: now() })
			.where(eq(catalogItems.id, id))
			.returning()
			.get() ?? notFound("Item");

	return {
		get,

		list({ search, includeArchived = false }: CatalogListOptions = {}): CatalogItem[] {
			const term = search?.trim();
			return db
				.select()
				.from(catalogItems)
				.where(
					and(
						includeArchived ? undefined : isNull(catalogItems.archivedAt),
						term
							? sql`${catalogItems.description} LIKE ${likePattern(term)} ESCAPE '\\'`
							: undefined,
					),
				)
				.orderBy(asc(sql`${catalogItems.description} COLLATE NOCASE`))
				.all();
		},

		create(input: CatalogItemInput): CatalogItem {
			const values = parse(input);
			const timestamp = now();
			return db
				.insert(catalogItems)
				.values({
					...values,
					id: newId(),
					archivedAt: null,
					createdAt: timestamp,
					updatedAt: timestamp,
				})
				.returning()
				.get();
		},

		update(id: string, input: CatalogItemInput): CatalogItem {
			const values = parse(input);
			return (
				db
					.update(catalogItems)
					.set({ ...values, updatedAt: now() })
					.where(eq(catalogItems.id, id))
					.returning()
					.get() ?? notFound("Item")
			);
		},

		archive: (id: string) => setArchived(id, now()),
		unarchive: (id: string) => setArchived(id, null),
	};
}
