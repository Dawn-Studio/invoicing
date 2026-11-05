/** Contract between preload and renderer. Phase 1 replaces this with the typed IPC layer. */
export interface AppInfo {
	name: string;
	version: string;
}

export interface DesktopApi {
	/** Value of `process.platform` in the preload, e.g. "darwin", "win32", "linux". */
	platform: string;
	getAppInfo(): Promise<AppInfo>;
}

export const IpcChannel = {
	GetAppInfo: "app:get-info",
} as const;
