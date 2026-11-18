import { contextBridge, ipcRenderer } from "electron";
import { type DesktopApi, RPC_CHANNEL } from "../shared/api";

const api: DesktopApi = {
	platform: process.platform,
	glass: process.argv.includes("--glass"),
	invoke: (channel, input) => ipcRenderer.invoke(RPC_CHANNEL, channel, input),
};

contextBridge.exposeInMainWorld("api", api);
