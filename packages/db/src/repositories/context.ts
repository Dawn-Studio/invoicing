import { DomainError, todayIso, uuidv7 } from "@dawnstudio/core";
import type { Db } from "../database";

/** Shared by all repositories; the clock is injectable so tests are deterministic. */
export interface RepositoryContext {
	db: Db;
	now: () => number;
	today: () => string;
	newId: () => string;
}

export function createContext(db: Db, overrides: Partial<Omit<RepositoryContext, "db">> = {}) {
	return {
		db,
		now: overrides.now ?? (() => Date.now()),
		today: overrides.today ?? (() => todayIso()),
		newId: overrides.newId ?? (() => uuidv7()),
	} satisfies RepositoryContext;
}

export function notFound(what: string): never {
	throw new DomainError("NOT_FOUND", `${what} not found`);
}

/** Escapes LIKE wildcards in user input; pair with `ESCAPE '\'`. */
export function likePattern(search: string): string {
	return `%${search.replaceAll(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
