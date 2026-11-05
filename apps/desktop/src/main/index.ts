import { join } from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { type AppInfo, IpcChannel } from "../shared/api";

const isMac = process.platform === "darwin";

// Matches --background in packages/ui theme.css, so the window never flashes white in dark mode.
const backgroundColor = () => (nativeTheme.shouldUseDarkColors ? "#0c0a09" : "#ffffff");

function createWindow() {
	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 960,
		minHeight: 600,
		show: false,
		title: "Invoicing",
		backgroundColor: backgroundColor(),
		titleBarStyle: isMac ? "hiddenInset" : "default",
		trafficLightPosition: { x: 18, y: 18 },
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	window.once("ready-to-show", () => window.show());

	// Links with target=_blank open in the default browser; the app never opens new windows itself.
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("https://")) void shell.openExternal(url);
		return { action: "deny" };
	});

	// The renderer is a single-page app: block any navigation away from it.
	window.webContents.on("will-navigate", (event, url) => {
		if (url !== window.webContents.getURL()) event.preventDefault();
	});

	const devServerUrl = process.env.ELECTRON_RENDERER_URL;
	if (!app.isPackaged && devServerUrl) {
		void window.loadURL(devServerUrl);
	} else {
		void window.loadFile(join(__dirname, "../renderer/index.html"));
	}
}

function registerIpc() {
	ipcMain.handle(
		IpcChannel.GetAppInfo,
		(): AppInfo => ({ name: app.getName(), version: app.getVersion() }),
	);
}

app.whenReady().then(() => {
	app.setAppUserModelId("com.dawnstudio.invoicing");
	registerIpc();
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (!isMac) app.quit();
});
