import {
	type Branding,
	type BrandingInput,
	type BusinessProfile,
	brandingSchema,
	DomainError,
	type ProfileInput,
	profileInputSchema,
} from "@dawnstudio/core";
import { eq } from "drizzle-orm";
import { businessProfiles } from "../schema";
import type { RepositoryContext } from "./context";

/** The app has one business profile for now; the table allows more later. */
export function profileRepository({ db, now, newId }: RepositoryContext) {
	const get = (): BusinessProfile | null => {
		const row = db.select().from(businessProfiles).limit(1).get();
		// Branding saved before newer fields existed gets their defaults.
		return row ? { ...row, branding: brandingSchema.parse(row.branding) } : null;
	};

	return {
		get,

		save(input: ProfileInput): BusinessProfile {
			const values = profileInputSchema.parse(input);
			const existing = get();
			const timestamp = now();
			if (existing) {
				// Branding has its own setter, so a stale copy in the details form can't undo it.
				const { branding: _, ...details } = values;
				db.update(businessProfiles)
					.set({ ...details, updatedAt: timestamp })
					.where(eq(businessProfiles.id, existing.id))
					.run();
				return get() as BusinessProfile;
			}
			db.insert(businessProfiles)
				.values({
					...values,
					id: newId(),
					logoFile: null,
					createdAt: timestamp,
					updatedAt: timestamp,
				})
				.run();
			return get() as BusinessProfile;
		},

		setBranding(input: BrandingInput): BusinessProfile {
			const branding: Branding = brandingSchema.parse(input);
			const existing = get();
			if (!existing) throw new DomainError("VALIDATION", "Set up your business profile first");
			db.update(businessProfiles)
				.set({ branding, updatedAt: now() })
				.where(eq(businessProfiles.id, existing.id))
				.run();
			return get() as BusinessProfile;
		},

		setLogoFile(logoFile: string | null): BusinessProfile | null {
			const existing = get();
			if (!existing) return null;
			db.update(businessProfiles)
				.set({ logoFile, updatedAt: now() })
				.where(eq(businessProfiles.id, existing.id))
				.run();
			return get();
		},
	};
}
