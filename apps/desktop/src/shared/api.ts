import type { RpcResult } from "./contract";

/** The one IPC channel all typed calls go through. Kept here so the preload imports nothing heavy. */
export const RPC_CHANNEL = "rpc";

/** Synchronous read of the saved palette, so the first paint already uses it. */
export const PALETTE_CHANNEL = "palette";

/** Main → renderer: menu commands and other things the window should react to. */
export const COMMAND_CHANNEL = "command";

/** Places the native menu can take the user to. */
export const ROUTES = {
	dashboard: "/",
	invoices: "/invoices",
	clients: "/clients",
	items: "/items",
	reports: "/reports",
	settings: "/settings",
	about: "/settings/about",
} as const;

/** What the native menu (or main process) asks the window to do. */
export type AppCommand =
	| { type: "navigate"; to: keyof typeof ROUTES }
	| { type: "palette" }
	| { type: "shortcuts" }
	| { type: "invoice.new" }
	| { type: "client.new" }
	| { type: "backup.now" }
	| { type: "backup.export" }
	| { type: "backup.restore" }
	/** The theme was changed from the menu; settings should show the new value. */
	| { type: "theme.changed" }
	/** The update status changed (checking, found, downloaded…). */
	| { type: "update.status" };

/** What the preload script exposes on `window.api`. */
export interface DesktopApi {
	/** Value of `process.platform` in the preload, e.g. "darwin", "win32", "linux". */
	platform: string;
	/** The window is translucent (macOS vibrancy / Windows acrylic); see main/index.ts. */
	glass: boolean;
	/** The colour palette saved when the page loaded; later changes come from the settings. */
	palette: string;
	/** Low-level call into the main process; use the typed `rpc` helper in the renderer instead. */
	invoke(channel: string, input: unknown): Promise<RpcResult<unknown>>;
	/** Listens for commands from the main process; returns a function that stops listening. */
	onCommand(listener: (command: AppCommand) => void): () => void;
}
