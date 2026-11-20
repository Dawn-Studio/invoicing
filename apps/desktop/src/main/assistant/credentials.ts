import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app, safeStorage } from "electron";
import { z } from "zod";

/**
 * Provider credentials for this computer: the OpenRouter key and the ChatGPT tokens. They
 * belong to the person, not to a workspace, so they live outside workspace files and backups,
 * encrypted with the OS keychain (Electron safeStorage). Nothing here ever reaches the renderer.
 */

const chatgptSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	idToken: z.string().default(""),
	/** Unix ms. */
	expiresAt: z.number(),
	scopes: z.array(z.string()),
	email: z.string().nullable().default(null),
	subject: z.string().nullable().default(null),
});
export type ChatGptTokens = z.infer<typeof chatgptSchema>;

const credentialsSchema = z.object({
	/** This install's stable id for "Sign in with ChatGPT" (`ext_agent_host_id`). */
	hostId: z.string().optional(),
	/** The client id OpenAI issued on first sign-in; reused for every later sign-in. */
	chatgptClientId: z.string().optional(),
	chatgpt: chatgptSchema.optional(),
	openrouter: z
		.object({
			key: z.string(),
			via: z.enum(["oauth", "key"]),
		})
		.optional(),
});
export type Credentials = z.infer<typeof credentialsSchema>;

const file = () => join(app.getPath("userData"), "assistant-credentials.bin");

let cache: Credentials = {};
let loading: Promise<void> | null = null;
let writing: Promise<void> = Promise.resolve();

/** Reads and decrypts the stored credentials once; everything else uses the cached copy. */
export function loadCredentials(): Promise<void> {
	loading ??= (async () => {
		let bytes: Buffer;
		try {
			bytes = await readFile(file());
		} catch {
			return; // Nothing stored yet.
		}
		try {
			const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(bytes);
			cache = credentialsSchema.parse(JSON.parse(result));
			if (shouldReEncrypt) await updateCredentials({});
		} catch (error) {
			// A keychain change makes old secrets unreadable; the user connects again.
			console.error("Couldn't read the assistant credentials", error);
		}
	})();
	return loading;
}

/** The credentials as loaded (call `loadCredentials` first). */
export const readCredentials = (): Credentials => cache;

/** Saves a change; undefined values remove that entry. Writes happen one at a time. */
export function updateCredentials(patch: Partial<Credentials>): Promise<void> {
	const next: Credentials = { ...cache, ...patch };
	for (const key of Object.keys(patch) as (keyof Credentials)[]) {
		if (patch[key] === undefined) delete next[key];
	}
	cache = next;
	writing = writing
		.catch(() => {})
		.then(async () => {
			if (!(await safeStorage.isAsyncEncryptionAvailable())) {
				throw new Error("This computer can't store secrets safely (no keychain available)");
			}
			const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(next));
			await mkdir(dirname(file()), { recursive: true });
			const partial = `${file()}.partial`;
			await writeFile(partial, encrypted, { mode: 0o600 });
			await rename(partial, file());
			await chmod(file(), 0o600).catch(() => {
				// Windows: permissions come from the user profile folder.
			});
		});
	return writing;
}

/** A stable per-install id, created before the first ChatGPT sign-in and never changed. */
export async function hostId(): Promise<string> {
	const existing = cache.hostId;
	if (existing) return existing;
	const id = `urn:uuid:${randomUUID()}`;
	await updateCredentials({ hostId: id });
	return id;
}
