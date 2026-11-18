import { join } from "node:path";
import { app, BrowserWindow, dialog, nativeTheme, shell } from "electron";
import { createHandlers } from "./handlers";
import { registerRpc } from "./rpc";
import { WorkspaceManager } from "./workspaces";

const isMac = process.platform === "darwin";

// Keep development data apart from the installed app's real invoices.
if (!app.isPackaged) app.setPath("userData", join(app.getPath("appData"), "Invoicing (Dev)"));

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

app.whenReady().then(() => {
	app.setAppUserModelId("com.dawnstudio.invoicing");

	let workspaces: WorkspaceManager;
	try {
		workspaces = new WorkspaceManager();
	} catch (error) {
		dialog.showErrorBox(
			"Invoicing couldn't open its database",
			`Your data hasn't been changed.\n\n${error instanceof Error ? error.message : String(error)}`,
		);
		app.exit(1);
		return;
	}
	app.on("will-quit", () => workspaces.close());

	registerRpc(createHandlers(workspaces));
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (!isMac) app.quit();
});
