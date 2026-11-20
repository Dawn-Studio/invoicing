import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import {
	type AppCommand,
	ASSISTANT_ABORT_CHANNEL,
	ASSISTANT_SEND_CHANNEL,
	ASSISTANT_STREAM_CHANNEL,
	type AssistantStreamEvent,
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
	assistant: (request, listener) => {
		const handle = (_event: IpcRendererEvent, event: AssistantStreamEvent) => {
			if (event.requestId !== request.requestId) return;
			listener(event);
			if (event.type !== "chunk") ipcRenderer.off(ASSISTANT_STREAM_CHANNEL, handle);
		};
		ipcRenderer.on(ASSISTANT_STREAM_CHANNEL, handle);
		ipcRenderer.send(ASSISTANT_SEND_CHANNEL, request);
		return () => {
			ipcRenderer.off(ASSISTANT_STREAM_CHANNEL, handle);
			ipcRenderer.send(ASSISTANT_ABORT_CHANNEL, request.requestId);
		};
	},
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
