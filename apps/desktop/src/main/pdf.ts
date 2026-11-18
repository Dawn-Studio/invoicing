import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	type Branding,
	DEFAULT_EXPORT_PATTERN,
	DomainError,
	exportFileName,
	type Invoice,
} from "@dawnstudio/core";
import type { Repositories } from "@dawnstudio/db";
import { app, BrowserWindow, dialog, shell } from "electron";
import type { ExportSettings } from "../shared/contract";

/**
 * PDFs come from the same React template as the on-screen preview: a hidden window opens the
 * renderer's print route for the invoice, waits until it has drawn (data, fonts, logo), and
 * Chromium prints it. What you see in the app is what the client gets.
 */

const READY_TIMEOUT_MS = 15_000;

const PATTERN_KEY = "export.pattern";
const FOLDER_KEY = "export.folder";

export function getExportSettings(repos: Repositories): ExportSettings {
	return {
		pattern: repos.settings.get<string>(PATTERN_KEY) ?? DEFAULT_EXPORT_PATTERN,
		folder: repos.settings.get<string>(FOLDER_KEY) ?? app.getPath("downloads"),
	};
}

export function saveExportSettings(repos: Repositories, input: Partial<ExportSettings>) {
	if (input.pattern !== undefined) repos.settings.set(PATTERN_KEY, input.pattern.trim());
	if (input.folder !== undefined) repos.settings.set(FOLDER_KEY, input.folder);
	return getExportSettings(repos);
}

export async function chooseExportFolder(repos: Repositories): Promise<ExportSettings | null> {
	const window = BrowserWindow.getFocusedWindow();
	const options = {
		title: "Default folder for PDFs",
		defaultPath: getExportSettings(repos).folder,
		properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[],
	};
	const result = window
		? await dialog.showOpenDialog(window, options)
		: await dialog.showOpenDialog(options);
	const folder = result.canceled ? null : result.filePaths[0];
	return folder ? saveExportSettings(repos, { folder }) : null;
}

/** Paths this session wrote, the only ones the renderer may reveal in Finder. */
const exported = new Set<string>();

export function revealExported(path: string) {
	if (!exported.has(path)) throw new DomainError("NOT_FOUND", "That file wasn't exported here");
	shell.showItemInFolder(path);
}

function issuedOnly(invoice: Invoice) {
	if (!invoice.snapshot || !invoice.number) {
		throw new DomainError("INVALID_STATE", "Issue the invoice before exporting it");
	}
	return { ...invoice, snapshot: invoice.snapshot, number: invoice.number };
}

/** Opens the print route for an invoice in a hidden window and waits until it has drawn. */
async function openPrintWindow(invoiceId: string): Promise<BrowserWindow> {
	const window = new BrowserWindow({
		show: false,
		width: 900,
		height: 1200,
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	const hash = `/print/${invoiceId}`;
	const devServerUrl = process.env.ELECTRON_RENDERER_URL;
	try {
		if (!app.isPackaged && devServerUrl) await window.loadURL(`${devServerUrl}#${hash}`);
		else await window.loadFile(join(__dirname, "../renderer/index.html"), { hash });

		const started = Date.now();
		for (;;) {
			const state = await window.webContents.executeJavaScript(
				"document.documentElement.dataset.print ?? ''",
			);
			if (state === "ready") return window;
			if (state === "error") throw new Error("The invoice couldn't be drawn for printing");
			if (Date.now() - started > READY_TIMEOUT_MS) throw new Error("Printing timed out");
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	} catch (error) {
		window.destroy();
		throw error;
	}
}

const pageSize = (branding: Branding) => (branding.paperSize === "letter" ? "Letter" : "A4");

export async function renderPdf(invoice: Invoice): Promise<Buffer> {
	const { snapshot } = issuedOnly(invoice);
	const window = await openPrintWindow(invoice.id);
	try {
		return await window.webContents.printToPDF({
			pageSize: pageSize(snapshot.branding),
			printBackground: true,
			// The template draws its own margins.
			margins: { top: 0, bottom: 0, left: 0, right: 0 },
		});
	} finally {
		window.destroy();
	}
}

/** Asks where to save (named from the pattern, in the last folder used), then writes the PDF. */
export async function exportPdf(
	repos: Repositories,
	invoiceId: string,
): Promise<{ path: string; fileName: string } | null> {
	const invoice = issuedOnly(repos.invoices.get(invoiceId));
	const settings = getExportSettings(repos);
	const suggested = exportFileName(settings.pattern, {
		number: invoice.number,
		client: invoice.snapshot.client.name,
		date: invoice.issueDate,
	});

	// Render first so a failure shows up before the user picks a file.
	const pdf = await renderPdf(invoice);
	const window = BrowserWindow.getFocusedWindow();
	const options = {
		title: `Export ${invoice.number}`,
		defaultPath: join(settings.folder, suggested),
		filters: [{ name: "PDF", extensions: ["pdf"] }],
	};
	const result = window
		? await dialog.showSaveDialog(window, options)
		: await dialog.showSaveDialog(options);
	if (result.canceled || !result.filePath) return null;

	const path = result.filePath.toLowerCase().endsWith(".pdf")
		? result.filePath
		: `${result.filePath}.pdf`;
	writeFileSync(path, pdf);
	saveExportSettings(repos, { folder: dirname(path) });
	repos.invoices.recordExport(invoice.id, path.split(/[\\/]/).pop() ?? suggested);
	exported.add(path);
	return { path, fileName: path.split(/[\\/]/).pop() ?? suggested };
}

/** The system print dialog for an issued invoice. */
export async function printInvoice(repos: Repositories, invoiceId: string): Promise<boolean> {
	const invoice = issuedOnly(repos.invoices.get(invoiceId));
	const window = await openPrintWindow(invoice.id);
	return new Promise((resolve) => {
		window.webContents.print(
			{ silent: false, printBackground: true, margins: { marginType: "none" } },
			(success) => {
				window.destroy();
				resolve(success);
			},
		);
	});
}
