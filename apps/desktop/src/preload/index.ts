import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import {
	type AppCommand,
	COMMAND_CHANNEL,
	type DesktopApi,
	PALETTE_CHANNEL,
	RPC_CHANNEL,
} from "../shared/api";

const api: DesktopApi = {
	platform: process.platform,
	glass: process.argv.includes("--glass"),
	palette: String(ipcRenderer.sendSync(PALETTE_CHANNEL) ?? "lime"),
	invoke: (channel, input) => ipcRenderer.invoke(RPC_CHANNEL, channel, input),
	onCommand: (listener) => {
		// Never hand the renderer the IPC event (it exposes `sender`).
		const handle = (_event: IpcRendererEvent, command: AppCommand) => listener(command);
		ipcRenderer.on(COMMAND_CHANNEL, handle);
		return () => {
			ipcRenderer.off(COMMAND_CHANNEL, handle);
		};
	},
};

contextBridge.exposeInMainWorld("api", api);
