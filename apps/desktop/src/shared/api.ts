import type { RpcResult } from "./contract";

/** The one IPC channel all typed calls go through. Kept here so the preload imports nothing heavy. */
export const RPC_CHANNEL = "rpc";

/** What the preload script exposes on `window.api`. */
export interface DesktopApi {
	/** Value of `process.platform` in the preload, e.g. "darwin", "win32", "linux". */
	platform: string;
	/** Low-level call into the main process; use the typed `rpc` helper in the renderer instead. */
	invoke(channel: string, input: unknown): Promise<RpcResult<unknown>>;
}
