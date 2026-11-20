import { app, type BrowserWindow, Menu, type MenuItemConstructorOptions, shell } from "electron";
import { type AppCommand, COMMAND_CHANNEL, type ROUTES } from "../shared/api";
import type { Theme } from "../shared/contract";
import { getTheme, setTheme } from "./preferences";

const isMac = process.platform === "darwin";

interface MenuOptions {
	/** The main window, or null when it's closed (macOS keeps running without one). */
	window: () => BrowserWindow | null;
	/** Opens the main window when there is none. */
	openWindow: () => void;
	checkForUpdates: () => void;
}

/**
 * The native menu: the macOS menu bar, or the window's menu bar on Windows and Linux. Most
 * items ask the window to do what the matching button or shortcut there does. Call the
 * returned function to rebuild it (the Appearance checkmarks follow the saved theme).
 */
export function installMenu({ window, openWindow, checkForUpdates }: MenuOptions) {
	const send = (command: AppCommand) => {
		const target = window();
		if (!target) {
			openWindow();
			return;
		}
		if (target.isMinimized()) target.restore();
		target.focus();
		target.webContents.send(COMMAND_CHANNEL, command);
	};

	const go = (
		label: string,
		to: keyof typeof ROUTES,
		accelerator?: string,
	): MenuItemConstructorOptions => ({
		label,
		accelerator,
		click: () => send({ type: "navigate", to }),
	});

	const themeItem = (label: string, theme: Theme): MenuItemConstructorOptions => ({
		label,
		type: "radio",
		checked: getTheme() === theme,
		click: () => {
			setTheme(theme);
			send({ type: "theme.changed" });
		},
	});

	const checkUpdates: MenuItemConstructorOptions = {
		label: "Check for Updates…",
		click: () => {
			send({ type: "navigate", to: "about" });
			checkForUpdates();
		},
	};

	const settings: MenuItemConstructorOptions = {
		label: isMac ? "Settings…" : "Settings",
		accelerator: "CmdOrCtrl+,",
		click: () => send({ type: "navigate", to: "settings" }),
	};

	const build = () => {
		const template: MenuItemConstructorOptions[] = [
			...(isMac
				? [
						{
							label: app.name,
							submenu: [
								{
									label: `About ${app.name}`,
									click: () => send({ type: "navigate", to: "about" }),
								},
								checkUpdates,
								{ type: "separator" },
								settings,
								{ type: "separator" },
								{ role: "services" },
								{ type: "separator" },
								{ role: "hide" },
								{ role: "hideOthers" },
								{ role: "unhide" },
								{ type: "separator" },
								{ role: "quit" },
							],
						} satisfies MenuItemConstructorOptions,
					]
				: []),
			{
				label: "File",
				submenu: [
					{
						label: "New Invoice",
						accelerator: "CmdOrCtrl+N",
						click: () => send({ type: "invoice.new" }),
					},
					{
						label: "New Client",
						accelerator: "CmdOrCtrl+Shift+N",
						click: () => send({ type: "client.new" }),
					},
					{ type: "separator" },
					{ label: "Back Up Now", click: () => send({ type: "backup.now" }) },
					{ label: "Save Backup As…", click: () => send({ type: "backup.export" }) },
					{ label: "Restore from Backup…", click: () => send({ type: "backup.restore" }) },
					{ type: "separator" },
					{
						label: isMac ? "Show Data Folder in Finder" : "Open Data Folder",
						click: () => void shell.openPath(app.getPath("userData")),
					},
					{ type: "separator" },
					...(isMac
						? [{ role: "close" } satisfies MenuItemConstructorOptions]
						: [
								settings,
								{ type: "separator" } satisfies MenuItemConstructorOptions,
								{ role: "quit" } satisfies MenuItemConstructorOptions,
							]),
				],
			},
			{ role: "editMenu" },
			{
				label: "View",
				submenu: [
					{
						label: "Command Palette…",
						accelerator: "CmdOrCtrl+K",
						click: () => send({ type: "palette" }),
					},
					{
						label: "Assistant",
						accelerator: "CmdOrCtrl+J",
						click: () => send({ type: "assistant.toggle" }),
					},
					{ type: "separator" },
					{
						label: "Appearance",
						submenu: [
							themeItem("Match System", "system"),
							themeItem("Light", "light"),
							themeItem("Dark", "dark"),
						],
					},
					{ type: "separator" },
					...(app.isPackaged
						? []
						: ([
								{ role: "reload" },
								{ role: "toggleDevTools" },
								{ type: "separator" },
							] satisfies MenuItemConstructorOptions[])),
					{ role: "resetZoom" },
					{ role: "zoomIn" },
					{ role: "zoomOut" },
					{ type: "separator" },
					{ role: "togglefullscreen" },
				],
			},
			{
				label: "Go",
				submenu: [
					go("Home", "home", "CmdOrCtrl+0"),
					go("Dashboard", "dashboard", "CmdOrCtrl+1"),
					go("Invoices", "invoices", "CmdOrCtrl+2"),
					go("Clients", "clients", "CmdOrCtrl+3"),
					go("Items", "items", "CmdOrCtrl+4"),
					go("Reports", "reports", "CmdOrCtrl+5"),
				],
			},
			{ role: "windowMenu" },
			{
				role: "help",
				submenu: [
					{
						label: "Keyboard Shortcuts",
						accelerator: "CmdOrCtrl+/",
						click: () => send({ type: "shortcuts" }),
					},
					...(isMac
						? []
						: ([
								{ type: "separator" },
								checkUpdates,
								{ label: "About Invoicing", click: () => send({ type: "navigate", to: "about" }) },
							] satisfies MenuItemConstructorOptions[])),
				],
			},
		];
		Menu.setApplicationMenu(Menu.buildFromTemplate(template));
	};

	build();
	return build;
}
