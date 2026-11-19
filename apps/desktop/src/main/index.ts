import { release } from "node:os";
import { join } from "node:path";
import {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	nativeImage,
	nativeTheme,
	screen,
	shell,
} from "electron";
import { PALETTE_CHANNEL } from "../shared/api";
import { discardAllStaged } from "./backups";
import { createHandlers } from "./handlers";
import { installMenu } from "./menu";
import { getPalette, getTheme, getWindowBounds, saveWindowBounds, setTheme } from "./preferences";
import { registerRpc } from "./rpc";
import { WorkspaceManager } from "./workspaces";

const isMac = process.platform === "darwin";

// Keep development data apart from the installed app's real invoices.
if (!app.isPackaged) app.setPath("userData", join(app.getPath("appData"), "Invoicing (Dev)"));

// Matches --background in packages/ui theme.css, so the window never flashes white in dark mode.
const backgroundColor = () => (nativeTheme.shouldUseDarkColors ? "#0e100c" : "#ffffff");

/**
 * Translucent "glass" window: macOS vibrancy, or acrylic on Windows 11 (build 22621+, the
 * first with backgroundMaterial). Elsewhere the window stays opaque and the renderer uses
 * solid colours. The preload reads `--glass` and tells the renderer.
 */
const glass =
	isMac || (process.platform === "win32" && Number(release().split(".")[2] ?? 0) >= 22_621);

const glassOptions = (): Electron.BrowserWindowConstructorOptions =>
	!glass
		? { backgroundColor: backgroundColor() }
		: isMac
			? { vibrancy: "sidebar", visualEffectState: "followWindow", backgroundColor: "#00000000" }
			: { backgroundMaterial: "acrylic", backgroundColor: "#00000000" };

let mainWindow: BrowserWindow | null = null;

/** The saved window position, if it still fits on a connected display. */
function restoredBounds() {
	const saved = getWindowBounds();
	if (!saved) return null;
	const visible = screen.getAllDisplays().some(({ workArea: area }) => {
		const overlapX =
			Math.min(saved.x + saved.width, area.x + area.width) - Math.max(saved.x, area.x);
		const overlapY =
			Math.min(saved.y + saved.height, area.y + area.height) - Math.max(saved.y, area.y);
		return overlapX >= 100 && overlapY >= 50;
	});
	return visible ? saved : null;
}

/** Remembers where the window was, so the next launch opens it there. */
function trackBounds(window: BrowserWindow) {
	let timer: NodeJS.Timeout | undefined;
	const save = () => {
		if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
		const maximized = window.isMaximized();
		const bounds = maximized ? window.getNormalBounds() : window.getBounds();
		saveWindowBounds({ ...bounds, maximized });
	};
	const later = () => {
		clearTimeout(timer);
		timer = setTimeout(save, 500);
	};
	window.on("resize", later);
	window.on("move", later);
	window.on("close", () => {
		clearTimeout(timer);
		save();
	});
}

function createWindow() {
	const bounds = restoredBounds();
	const window = new BrowserWindow({
		width: bounds?.width ?? 1280,
		height: bounds?.height ?? 820,
		...(bounds ? { x: bounds.x, y: bounds.y } : {}),
		minWidth: 960,
		minHeight: 600,
		show: false,
		title: "Invoicing",
		...glassOptions(),
		titleBarStyle: isMac ? "hiddenInset" : "default",
		trafficLightPosition: { x: 16, y: 16 },
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			additionalArguments: glass ? ["--glass"] : [],
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	mainWindow = window;
	window.on("closed", () => {
		if (mainWindow === window) mainWindow = null;
	});
	trackBounds(window);
	window.once("ready-to-show", () => {
		if (bounds?.maximized) window.maximize();
		window.show();
	});

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
	// Before the first window, so it opens in the chosen appearance and palette.
	setTheme(getTheme());
	ipcMain.on(PALETTE_CHANNEL, (event) => {
		event.returnValue = getPalette();
	});
	// The packaged app gets its icon from the bundle; in development, show it in the Dock too.
	if (isMac && !app.isPackaged) {
		const icon = nativeImage.createFromPath(join(__dirname, "../../build/icon.png"));
		if (!icon.isEmpty()) app.dock?.setIcon(icon);
	}

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
	app.on("will-quit", () => {
		discardAllStaged();
		workspaces.close();
	});

	const refreshMenu = installMenu({ window: () => mainWindow, openWindow: createWindow });
	registerRpc(createHandlers(workspaces, { onThemeChanged: refreshMenu }));
	createWindow();

	// Opaque windows paint their own background; keep it in step with the theme.
	nativeTheme.on("updated", () => {
		if (!glass) mainWindow?.setBackgroundColor(backgroundColor());
	});

	// A daily backup: checked shortly after launch (not delaying the window) and every hour
	// for an app left open for days.
	setTimeout(() => workspaces.backupIfDue(), 5_000).unref();
	setInterval(() => workspaces.backupIfDue(), 60 * 60 * 1000).unref();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (!isMac) app.quit();
});
