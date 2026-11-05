import { contextBridge, ipcRenderer } from "electron";
import { type DesktopApi, IpcChannel } from "../shared/api";

const api: DesktopApi = {
	platform: process.platform,
	getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
};

contextBridge.exposeInMainWorld("api", api);
