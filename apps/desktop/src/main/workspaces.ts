import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DomainError, uuidv7 } from "@dawnstudio/core";
import { createRepositories, type OpenedDatabase, openDatabase } from "@dawnstudio/db";
import { app, shell } from "electron";
import { z } from "zod";
import type { Workspace, WorkspaceList } from "../shared/contract";

/**
 * Workspaces are separate businesses (e.g. "Personal" and "Studio"), each the issuer on its
 * own invoices. Every workspace is its own SQLite file, so nothing (clients, invoices,
 * numbering) can leak between them, and a workspace can be backed up or removed as a file.
 * `workspaces.json` lists them and remembers which one is open.
 */

const registrySchema = z.object({
	version: z.literal(1),
	activeId: z.string(),
	workspaces: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			/** Relative to the user data folder. */
			file: z.string(),
			createdAt: z.number(),
		}),
	),
});
type Registry = z.infer<typeof registrySchema>;

/** The database from before workspaces existed; it becomes the first workspace, unmoved. */
const LEGACY_FILE = "invoicing.db";

const userData = () => app.getPath("userData");
const registryPath = () => join(userData(), "workspaces.json");

function migrationsFolder() {
	return app.isPackaged
		? join(process.resourcesPath, "migrations")
		: join(__dirname, "../../../../packages/db/migrations");
}

export class WorkspaceManager {
	private registry: Registry;
	private opened: {
		id: string;
		database: OpenedDatabase;
		repos: ReturnType<typeof createRepositories>;
	};

	constructor() {
		this.registry = this.loadRegistry();
		this.opened = this.open(this.activeEntry().id);
	}

	/** Repositories of the open workspace. Read on every call: switching replaces them. */
	get repos() {
		return this.opened.repos;
	}

	get databasePath() {
		return join(userData(), this.activeEntry().file);
	}

	list(): WorkspaceList {
		return {
			activeId: this.registry.activeId,
			workspaces: this.registry.workspaces.map(({ file: _, ...workspace }) => workspace),
		};
	}

	create(name: string): Workspace {
		const id = uuidv7();
		mkdirSync(join(userData(), "workspaces"), { recursive: true });
		const entry = { id, name, file: join("workspaces", `${id}.db`), createdAt: Date.now() };
		this.registry.workspaces.push(entry);
		this.switchTo(id);
		return this.toWorkspace(entry);
	}

	switchTo(id: string): WorkspaceList {
		this.entry(id);
		if (id !== this.opened.id) {
			// Open the new one first: if it fails, the current workspace stays open.
			const next = this.open(id);
			this.opened.database.close();
			this.opened = next;
		}
		this.registry.activeId = id;
		this.save();
		return this.list();
	}

	rename(id: string, name: string): Workspace {
		const entry = this.entry(id);
		entry.name = name;
		this.save();
		return this.toWorkspace(entry);
	}

	/** Moves the workspace's file to the Trash (recoverable), then forgets it. */
	async remove(id: string): Promise<WorkspaceList> {
		const entry = this.entry(id);
		if (this.registry.workspaces.length === 1) {
			throw new DomainError("INVALID_STATE", "You can't delete your only workspace");
		}
		if (id === this.opened.id) {
			const other = this.registry.workspaces.find((w) => w.id !== id);
			if (other) this.switchTo(other.id);
		}
		const path = join(userData(), entry.file);
		for (const suffix of ["", "-wal", "-shm"]) {
			if (existsSync(path + suffix)) await shell.trashItem(path + suffix);
		}
		this.registry.workspaces = this.registry.workspaces.filter((w) => w.id !== id);
		this.save();
		return this.list();
	}

	close() {
		this.opened.database.close();
	}

	private open(id: string) {
		const entry = this.entry(id);
		const database = openDatabase({
			file: join(userData(), entry.file),
			migrationsFolder: migrationsFolder(),
		});
		return { id, database, repos: createRepositories(database.db) };
	}

	private entry(id: string) {
		const entry = this.registry.workspaces.find((w) => w.id === id);
		if (!entry) throw new DomainError("NOT_FOUND", "Workspace not found");
		return entry;
	}

	private activeEntry() {
		return (
			this.registry.workspaces.find((w) => w.id === this.registry.activeId) ??
			this.registry.workspaces[0] ??
			this.entry(this.registry.activeId)
		);
	}

	private toWorkspace({ file: _, ...workspace }: Registry["workspaces"][number]): Workspace {
		return workspace;
	}

	private loadRegistry(): Registry {
		if (existsSync(registryPath())) {
			return registrySchema.parse(JSON.parse(readFileSync(registryPath(), "utf8")));
		}
		// First run with workspaces: adopt the existing database (or start an empty one).
		const id = uuidv7();
		const registry: Registry = {
			version: 1,
			activeId: id,
			workspaces: [
				{ id, name: legacyName() ?? "My workspace", file: LEGACY_FILE, createdAt: Date.now() },
			],
		};
		this.registry = registry;
		this.save();
		return registry;
	}

	/** Written to a temp file and renamed, so a crash never leaves a half-written registry. */
	private save() {
		mkdirSync(userData(), { recursive: true });
		const temp = `${registryPath()}.tmp`;
		writeFileSync(temp, `${JSON.stringify(this.registry, null, "\t")}\n`);
		renameSync(temp, registryPath());
	}
}

/** Names the adopted workspace after the business already set up in it. */
function legacyName(): string | null {
	const file = join(userData(), LEGACY_FILE);
	if (!existsSync(file)) return null;
	let database: OpenedDatabase | null = null;
	try {
		database = openDatabase({ file, migrationsFolder: migrationsFolder() });
		return createRepositories(database.db).profile.get()?.name || null;
	} catch {
		return null;
	} finally {
		database?.close();
	}
}
