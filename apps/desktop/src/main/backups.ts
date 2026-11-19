import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DomainError, uuidv7 } from "@dawnstudio/core";
import { createRepositories, openDatabase } from "@dawnstudio/db";
import { app, BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import { unzipSync, zipSync } from "fflate";
import { z } from "zod";
import type { BackupEntry, BackupPreview, BackupReason } from "../shared/contract";
import { logosFolder } from "./files";

/**
 * A backup is one zip file per workspace: a consistent SQLite snapshot (`workspace.db`), the
 * logos its invoices print, and a manifest. Automatic, pre-update, pre-restore and manual
 * backups all use this format, so there's a single, validated way back.
 */

export const BACKUP_EXTENSION = "invoicingbackup";
const FORMAT = 1;
const MAX_BACKUP_BYTES = 1024 * 1024 * 1024;
const LOGO_NAME = /^[0-9a-f]{32}\.(png|jpg|webp|svg)$/;

/** How many of each kind a workspace keeps; older ones are deleted. */
const KEEP = { automatic: 14, other: 10 };
const AUTOMATIC: BackupReason[] = ["daily", "quit"];

const manifestSchema = z.object({
	format: z.literal(FORMAT),
	appVersion: z.string(),
	createdAt: z.number(),
	reason: z.enum(["daily", "quit", "pre-migration", "pre-restore", "manual"]),
	workspace: z.object({ id: z.string(), name: z.string() }),
});
type Manifest = z.infer<typeof manifestSchema>;

export const backupsRoot = () => join(app.getPath("userData"), "backups");
export const backupsFolder = (workspaceId: string) => join(backupsRoot(), workspaceId);

/** "2026-11-19T08-30-05-123Z_daily.invoicingbackup": sortable, and safe on every filesystem. */
const backupName = (createdAt: number, reason: BackupReason) =>
	`${new Date(createdAt).toISOString().replaceAll(":", "-").replace(".", "-")}_${reason}.${BACKUP_EXTENSION}`;
const NAME_PATTERN = new RegExp(
	`^(\\d{4}-\\d{2}-\\d{2})T(\\d{2})-(\\d{2})-(\\d{2})-(\\d{3})Z_(daily|quit|pre-migration|pre-restore|manual)\\.${BACKUP_EXTENSION}$`,
);

function parseName(name: string): { createdAt: number; reason: BackupReason } | null {
	const match = NAME_PATTERN.exec(name);
	if (!match) return null;
	const [, date, h, m, s, ms, reason] = match;
	return { createdAt: Date.parse(`${date}T${h}:${m}:${s}.${ms}Z`), reason: reason as BackupReason };
}

const tempPath = (suffix: string) => {
	const dir = join(app.getPath("temp"), "invoicing");
	mkdirSync(dir, { recursive: true });
	return join(dir, `${uuidv7()}${suffix}`);
};

/**
 * Writes a backup to `destination` (atomically: a temp file renamed into place).
 * `snapshot` writes a consistent copy of the workspace database to the path it's given.
 */
export function writeBackup(
	snapshot: (destination: string) => void,
	workspace: { id: string; name: string },
	destination: string,
	reason: BackupReason,
	createdAt = Date.now(),
) {
	const dbCopy = tempPath(".db");
	try {
		snapshot(dbCopy);
		const files: Record<string, Uint8Array> = {
			"workspace.db": readFileSync(dbCopy),
		};
		// Logos are shared by all workspaces and tiny; include them all so every invoice prints.
		if (existsSync(logosFolder())) {
			for (const name of readdirSync(logosFolder())) {
				if (LOGO_NAME.test(name)) files[`logos/${name}`] = readFileSync(join(logosFolder(), name));
			}
		}
		const manifest: Manifest = {
			format: FORMAT,
			appVersion: app.getVersion(),
			createdAt,
			reason,
			workspace: { id: workspace.id, name: workspace.name },
		};
		files["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, "\t"));

		const partial = `${destination}.partial`;
		writeFileSync(partial, zipSync(files, { level: 6 }));
		renameSync(partial, destination);
	} finally {
		rmSync(dbCopy, { force: true });
	}
}

/** Backs up into the workspace's backup folder and prunes old ones of the same kind. */
export function writeAutomaticBackup(
	snapshot: (destination: string) => void,
	workspace: { id: string; name: string },
	reason: BackupReason,
) {
	const folder = backupsFolder(workspace.id);
	mkdirSync(folder, { recursive: true });
	const createdAt = Date.now();
	writeBackup(snapshot, workspace, join(folder, backupName(createdAt, reason)), reason, createdAt);
	prune(workspace.id);
}

export function listBackups(workspaceId: string): BackupEntry[] {
	const folder = backupsFolder(workspaceId);
	if (!existsSync(folder)) return [];
	return readdirSync(folder)
		.flatMap((name) => {
			const parsed = parseName(name);
			return parsed ? [{ name, ...parsed, size: statSync(join(folder, name)).size }] : [];
		})
		.sort((a, b) => b.createdAt - a.createdAt);
}

function prune(workspaceId: string) {
	const all = listBackups(workspaceId);
	const automatic = all.filter((b) => AUTOMATIC.includes(b.reason));
	const other = all.filter((b) => !AUTOMATIC.includes(b.reason));
	for (const backup of [...automatic.slice(KEEP.automatic), ...other.slice(KEEP.other)]) {
		rmSync(join(backupsFolder(workspaceId), backup.name), { force: true });
	}
}

/** Path of one of the workspace's own backups, by name (never a path from the renderer). */
export function backupPath(workspaceId: string, name: string): string {
	if (!parseName(name) || !existsSync(join(backupsFolder(workspaceId), name))) {
		throw new DomainError("NOT_FOUND", "That backup no longer exists");
	}
	return join(backupsFolder(workspaceId), name);
}

/** A backup that has been checked and unpacked, waiting for the user to confirm the restore. */
export interface StagedBackup {
	token: string;
	databaseFile: string;
	logos: Record<string, Uint8Array>;
	manifest: Manifest;
	preview: BackupPreview;
}

const staged = new Map<string, StagedBackup>();

const invalid = () =>
	new DomainError("VALIDATION", "This file isn't an Invoicing backup, or it's damaged");

/**
 * Unpacks a backup into a temporary copy and proves it opens: the zip and manifest are
 * checked, SQLite's integrity check must pass, and migrations are brought up to date on the
 * copy. Nothing in the app changes until `takeStaged` is used to restore it.
 */
export function stageBackup(file: string): BackupPreview {
	discardAllStaged();
	if (statSync(file).size > MAX_BACKUP_BYTES) throw invalid();

	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(readFileSync(file));
	} catch {
		throw invalid();
	}
	const manifestBytes = entries["manifest.json"];
	const database = entries["workspace.db"];
	if (!manifestBytes || !database) throw invalid();
	const parsed = manifestSchema.safeParse(
		(() => {
			try {
				return JSON.parse(new TextDecoder().decode(manifestBytes));
			} catch {
				return null;
			}
		})(),
	);
	if (!parsed.success) throw invalid();
	const logos: Record<string, Uint8Array> = {};
	for (const [path, bytes] of Object.entries(entries)) {
		if (path === "manifest.json" || path === "workspace.db" || path.endsWith("/")) continue;
		const name = path.startsWith("logos/") ? path.slice("logos/".length) : "";
		if (!LOGO_NAME.test(name)) throw invalid();
		logos[name] = bytes;
	}

	const databaseFile = tempPath(".db");
	writeFileSync(databaseFile, database);
	let preview: BackupPreview;
	try {
		const opened = openDatabase({ file: databaseFile, migrationsFolder: migrationsFolder() });
		try {
			if (opened.integrityCheck() !== "ok") throw invalid();
			const repos = createRepositories(opened.db);
			const invoices = repos.invoices.list();
			preview = {
				token: uuidv7(),
				workspaceName: parsed.data.workspace.name,
				businessName: repos.profile.get()?.name ?? null,
				createdAt: parsed.data.createdAt,
				reason: parsed.data.reason,
				appVersion: parsed.data.appVersion,
				clients: repos.clients.list({ includeArchived: true }).length,
				invoices: invoices.filter((invoice) => invoice.status !== "draft").length,
				drafts: invoices.filter((invoice) => invoice.status === "draft").length,
			};
		} finally {
			opened.close();
		}
	} catch (error) {
		rmSync(databaseFile, { force: true });
		// Keep our own messages (e.g. "saved by a newer version"); anything else means damaged.
		throw error instanceof DomainError ? error : invalid();
	}

	staged.set(preview.token, {
		token: preview.token,
		databaseFile,
		logos,
		manifest: parsed.data,
		preview,
	});
	return preview;
}

/** Hands over a staged backup (the caller now owns its temp file) and copies its logos in. */
export function takeStaged(token: string): StagedBackup {
	const backup = staged.get(token);
	if (!backup) throw new DomainError("NOT_FOUND", "Choose the backup again");
	staged.delete(token);
	mkdirSync(logosFolder(), { recursive: true });
	for (const [name, bytes] of Object.entries(backup.logos)) {
		const target = join(logosFolder(), name);
		// Logo names are content hashes: an existing file is already the same image.
		if (!existsSync(target)) writeFileSync(target, bytes);
	}
	return backup;
}

export function discardStaged(token: string) {
	const backup = staged.get(token);
	if (backup) rmSync(backup.databaseFile, { force: true });
	staged.delete(token);
}

export function discardAllStaged() {
	for (const token of [...staged.keys()]) discardStaged(token);
}

/** Copies a database file over another, replacing the old one's WAL files too. */
export function replaceDatabaseFile(source: string, target: string) {
	for (const suffix of ["-wal", "-shm"]) rmSync(target + suffix, { force: true });
	copyFileSync(source, target);
}

export function migrationsFolder() {
	return app.isPackaged
		? join(process.resourcesPath, "migrations")
		: join(__dirname, "../../../../packages/db/migrations");
}

const focused = () => BrowserWindow.getFocusedWindow();

/** Save dialog for a backup file; null when cancelled. */
export async function askBackupDestination(workspaceName: string): Promise<string | null> {
	const date = new Date().toISOString().slice(0, 10);
	const safeName =
		// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what we strip
		workspaceName.replaceAll(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "Invoicing";
	const options = {
		title: "Save backup",
		defaultPath: join(app.getPath("documents"), `${safeName} ${date}.${BACKUP_EXTENSION}`),
		filters: [{ name: "Invoicing backup", extensions: [BACKUP_EXTENSION] }],
	};
	const window = focused();
	const result = window
		? await dialog.showSaveDialog(window, options)
		: await dialog.showSaveDialog(options);
	if (result.canceled || !result.filePath) return null;
	return result.filePath.endsWith(`.${BACKUP_EXTENSION}`)
		? result.filePath
		: `${result.filePath}.${BACKUP_EXTENSION}`;
}

/** Open dialog for a backup file to restore; null when cancelled. */
export async function askBackupFile(): Promise<string | null> {
	const options: OpenDialogOptions = {
		title: "Restore from backup",
		filters: [{ name: "Invoicing backup", extensions: [BACKUP_EXTENSION] }],
		properties: ["openFile"],
	};
	const window = focused();
	const result = window
		? await dialog.showOpenDialog(window, options)
		: await dialog.showOpenDialog(options);
	return result.canceled ? null : (result.filePaths[0] ?? null);
}
