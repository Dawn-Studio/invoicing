import { join } from "node:path";
import { createRepositories, type OpenedDatabase, openDatabase } from "@dawnstudio/db";
import { app } from "electron";

/**
 * Migrations ship in Resources/ in production; in development they're read straight from
 * the db package (this file is bundled to apps/desktop/out/main).
 */
function migrationsFolder() {
	return app.isPackaged
		? join(process.resourcesPath, "migrations")
		: join(__dirname, "../../../../packages/db/migrations");
}

export function databasePath() {
	return join(app.getPath("userData"), "invoicing.db");
}

export function initDatabase(): {
	database: OpenedDatabase;
	repos: ReturnType<typeof createRepositories>;
} {
	const database = openDatabase({ file: databasePath(), migrationsFolder: migrationsFolder() });
	return { database, repos: createRepositories(database.db) };
}
