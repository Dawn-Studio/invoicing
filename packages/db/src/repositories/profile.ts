import { type BusinessProfile, type ProfileInput, profileInputSchema } from "@dawnstudio/core";
import { eq } from "drizzle-orm";
import { businessProfiles } from "../schema";
import type { RepositoryContext } from "./context";

/** The app has one business profile for now; the table allows more later. */
export function profileRepository({ db, now, newId }: RepositoryContext) {
	const get = (): BusinessProfile | null =>
		db.select().from(businessProfiles).limit(1).get() ?? null;

	return {
		get,

		save(input: ProfileInput): BusinessProfile {
			const values = profileInputSchema.parse(input);
			const existing = get();
			const timestamp = now();
			if (existing) {
				return db
					.update(businessProfiles)
					.set({ ...values, updatedAt: timestamp })
					.where(eq(businessProfiles.id, existing.id))
					.returning()
					.get();
			}
			return db
				.insert(businessProfiles)
				.values({
					...values,
					id: newId(),
					logoFile: null,
					createdAt: timestamp,
					updatedAt: timestamp,
				})
				.returning()
				.get();
		},

		setLogoFile(logoFile: string | null): BusinessProfile | null {
			const existing = get();
			if (!existing) return null;
			return db
				.update(businessProfiles)
				.set({ logoFile, updatedAt: now() })
				.where(eq(businessProfiles.id, existing.id))
				.returning()
				.get();
		},
	};
}
