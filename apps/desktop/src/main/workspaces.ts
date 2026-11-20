import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DomainError, uuidv7 } from "@dawnstudio/core";
import {
	createRepositories,
	type OpenedDatabase,
	openDatabase,
	peekBusinessName,
} from "@dawnstudio/db";
import { app, shell } from "electron";
import { z } from "zod";
import type { BackupReason, Workspace, WorkspaceList } from "../shared/contract";
import {
	listBackups,
	migrationsFolder,
	replaceDatabaseFile,
	takeStaged,
	writeAutomaticBackup,
	writeBackup,
} from "./backups";
import { LOGO_NAME } from "./files";

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
			/** A square image in the logo folder, shown instead of the initials. */
			avatarFile: z.string().regex(LOGO_NAME).nullish(),
		}),
	),
});
type Registry = z.infer<typeof registrySchema>;

/** The database from before workspaces existed; it becomes the first workspace, unmoved. */
const LEGACY_FILE = "invoicing.db";

const userData = () => app.getPath("userData");
const registryPath = () => join(userData(), "workspaces.json");

const DAY_MS = 24 * 60 * 60 * 1000;

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

	get active(): Workspace {
		return this.toWorkspace(this.activeEntry());
	}

	/** Backs up the open workspace now, into its backup folder. */
	backupNow(reason: BackupReason) {
		writeAutomaticBackup(this.opened.database.snapshot, this.entry(this.opened.id), reason);
	}

	/** Writes a backup of the open workspace to a file the user chose. */
	exportBackup(destination: string) {
		writeBackup(this.opened.database.snapshot, this.entry(this.opened.id), destination, "manual");
	}

	/** The daily backup, if the newest one is more than a day old. Never throws. */
	backupIfDue() {
		this.safely(() => {
			const newest = listBackups(this.opened.id)[0];
			if (!newest || Date.now() - newest.createdAt >= DAY_MS) this.backupNow("daily");
		});
	}

	/** On quit or switching away: backs up the open workspace if it changed since its last backup. */
	backupIfChanged() {
		this.safely(() => {
			const path = join(userData(), this.entry(this.opened.id).file);
			const modified = Math.max(
				...["", "-wal"].map((suffix) =>
					existsSync(path + suffix) ? statSync(path + suffix).mtimeMs : 0,
				),
			);
			const newest = listBackups(this.opened.id)[0];
			if (!newest || modified > newest.createdAt) this.backupNow("quit");
		});
	}

	/**
	 * Restores a staged backup, either as a new workspace (nothing existing is touched) or over
	 * the open one. Replacing first backs up the current data, and puts it back if the restored
	 * file won't open.
	 */
	restore(token: string, mode: "new" | "replace"): WorkspaceList {
		const backup = takeStaged(token);
		try {
			if (mode === "new") {
				const id = uuidv7();
				mkdirSync(join(userData(), "workspaces"), { recursive: true });
				const file = join("workspaces", `${id}.db`);
				replaceDatabaseFile(backup.databaseFile, join(userData(), file));
				this.registry.workspaces.push({
					id,
					name: `${backup.manifest.workspace.name} (restored)`,
					file,
					createdAt: Date.now(),
					avatarFile: backup.manifest.workspace.avatarFile ?? null,
				});
				try {
					return this.switchTo(id);
				} catch (error) {
					this.registry.workspaces = this.registry.workspaces.filter((w) => w.id !== id);
					this.save();
					throw error;
				}
			}

			const entry = this.entry(this.opened.id);
			this.backupNow("pre-restore");
			const path = join(userData(), entry.file);
			const previous = `${path}.before-restore`;
			this.opened.database.close();
			replaceDatabaseFile(path, previous);
			try {
				replaceDatabaseFile(backup.databaseFile, path);
				this.opened = this.open(entry.id);
			} catch (error) {
				replaceDatabaseFile(previous, path);
				this.opened = this.open(entry.id);
				throw error;
			} finally {
				rmSync(previous, { force: true });
			}
			return this.list();
		} finally {
			rmSync(backup.databaseFile, { force: true });
		}
	}

	list(): WorkspaceList {
		return {
			activeId: this.registry.activeId,
			workspaces: this.registry.workspaces.map((entry) => this.toWorkspace(entry)),
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
			this.backupIfChanged();
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

	/** `avatarFile` comes from `chooseLogo` (content-addressed in the logo folder), or null. */
	setAvatar(id: string, avatarFile: string | null): Workspace {
		const entry = this.entry(id);
		entry.avatarFile = avatarFile;
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

	/** Backs up what changed, then closes the database. */
	close() {
		this.backupIfChanged();
		this.opened.database.close();
	}

	/** Backups must never stop the app from working; failures are logged. */
	private safely(action: () => void) {
		try {
			action();
		} catch (error) {
			console.error("Backup failed", error);
		}
	}

	private open(id: string) {
		const entry = this.entry(id);
		const database = openDatabase({
			file: join(userData(), entry.file),
			migrationsFolder: migrationsFolder(),
			// An app update is about to change the tables: keep a copy of the data as it was.
			beforeMigrate: ({ snapshot }) => writeAutomaticBackup(snapshot, entry, "pre-migration"),
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

	private toWorkspace({
		id,
		name,
		createdAt,
		avatarFile,
	}: Registry["workspaces"][number]): Workspace {
		return { id, name, createdAt, avatarFile: avatarFile ?? null };
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
	// Read-only and without migrating: the real open (with its pre-update backup) comes next.
	return peekBusinessName(join(userData(), LEGACY_FILE));
}
