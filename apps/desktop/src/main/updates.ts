import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { app, shell } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateStatus } from "../shared/contract";

/**
 * Updates from GitHub Releases. The packaged app carries `app-update.yml` (written by
 * electron-builder from the `publish` settings) naming the repository; a development build
 * has none and never checks.
 *
 * Windows (NSIS) and the Linux AppImage download in the background and install on restart.
 * The macOS app is ad-hoc signed, which Squirrel.Mac refuses to update, and a .deb belongs to
 * the system package manager, so those only check and link to the release page.
 */

const FIRST_CHECK_MS = 15_000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const canInstall = process.platform === "win32" || Boolean(process.env.APPIMAGE);

/**
 * The update settings file: app-update.yml in the packaged app, or, to try updates in
 * development, a git-ignored dev-app-update.yml next to package.json (same format).
 */
const configFile = () =>
	app.isPackaged
		? join(process.resourcesPath, "app-update.yml")
		: join(app.getAppPath(), "dev-app-update.yml");

/** owner/repo from the update settings, for links to the release page. */
function repository(): { owner: string; repo: string } | null {
	const file = configFile();
	if (!existsSync(file)) return null;
	const text = readFileSync(file, "utf8");
	const field = (name: string) => new RegExp(`^${name}:\\s*["']?([^"'\\s]+)`, "m").exec(text)?.[1];
	const owner = field("owner");
	const repo = field("repo");
	return owner && repo ? { owner, repo } : null;
}

export class Updates {
	#status: UpdateStatus = { state: "unsupported" };
	readonly #repository = repository();
	readonly #onChange: () => void;

	constructor(onChange: () => void) {
		this.#onChange = onChange;
		if (!this.#repository) return;
		this.#status = { state: "idle", checkedAt: null };

		autoUpdater.logger = console;
		autoUpdater.forceDevUpdateConfig = !app.isPackaged;
		autoUpdater.autoDownload = canInstall;
		autoUpdater.autoInstallOnAppQuit = canInstall;
		autoUpdater.allowPrerelease = false;

		autoUpdater.on("checking-for-update", () => this.#set({ state: "checking" }));
		autoUpdater.on("update-not-available", () =>
			this.#set({ state: "idle", checkedAt: Date.now() }),
		);
		autoUpdater.on("update-available", ({ version }) =>
			this.#set(
				canInstall
					? { state: "downloading", version, percent: 0 }
					: { state: "available", version, url: this.#releaseUrl(version) },
			),
		);
		autoUpdater.on("download-progress", ({ percent }) => {
			if (this.#status.state !== "downloading") return;
			const next = Math.round(percent);
			const step = (value: number) => Math.floor(value / 5);
			// Tell the window every 5%, not on every chunk.
			if (step(next) === step(this.#status.percent))
				this.#status = { ...this.#status, percent: next };
			else this.#set({ ...this.#status, percent: next });
		});
		autoUpdater.on("update-downloaded", ({ version }) => this.#set({ state: "ready", version }));
		autoUpdater.on("error", (error) => this.#set({ state: "error", message: friendly(error) }));
	}

	get status() {
		return this.#status;
	}

	/** Checks shortly after launch and then every few hours. */
	start() {
		if (!this.#repository) return;
		setTimeout(() => void this.check(), FIRST_CHECK_MS).unref();
		setInterval(() => void this.check(), CHECK_EVERY_MS).unref();
	}

	async check(): Promise<UpdateStatus> {
		if (!this.#repository) return this.#status;
		// Don't restart a download, or forget one that's ready.
		if (["checking", "downloading", "ready"].includes(this.#status.state)) return this.#status;
		try {
			await autoUpdater.checkForUpdates();
		} catch (error) {
			this.#set({ state: "error", message: friendly(error) });
		}
		return this.#status;
	}

	/** Restarts into the downloaded update. */
	install() {
		if (this.#status.state !== "ready") return;
		// Let quit handlers (backups, closing the database) run first.
		setImmediate(() => autoUpdater.quitAndInstall(false, true));
	}

	/** Opens the release page of the available update. */
	async openDownload() {
		const url = this.#status.state === "available" ? this.#status.url : this.#releaseUrl(null);
		await shell.openExternal(url);
	}

	#releaseUrl(version: string | null) {
		const { owner, repo } = this.#repository ?? { owner: "", repo: "" };
		const base = `https://github.com/${owner}/${repo}/releases`;
		return version ? `${base}/tag/v${version}` : `${base}/latest`;
	}

	#set(status: UpdateStatus) {
		this.#status = status;
		this.#onChange();
	}
}

/** Network errors are expected offline; keep the message short and human. */
function friendly(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|net::ERR_/i.test(message)) {
		return "Couldn't reach GitHub. Check your connection and try again.";
	}
	if (/404|Cannot find latest/i.test(message)) return "No releases published yet.";
	return message.split("\n")[0] ?? "Couldn't check for updates";
}
