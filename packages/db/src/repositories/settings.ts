import { eq } from "drizzle-orm";
import { settings } from "../schema";
import type { RepositoryContext } from "./context";

/** Small app preferences that don't deserve their own table. */
export function settingsRepository({ db, now }: RepositoryContext) {
	return {
		get<T>(key: string): T | undefined {
			return db.select().from(settings).where(eq(settings.key, key)).get()?.value as T | undefined;
		},

		set(key: string, value: unknown): void {
			const updatedAt = now();
			db.insert(settings)
				.values({ key, value, updatedAt })
				.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } })
				.run();
		},
	};
}
