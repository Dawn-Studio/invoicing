import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	exportFileName,
	formatQuantity,
	formatRate,
	fromMinor,
	lineAmount,
	toCsv,
} from "@dawnstudio/core";
import type { Repositories } from "@dawnstudio/db";
import { BrowserWindow, dialog } from "electron";
import { zipSync } from "fflate";
import type { ReportExportKind } from "../shared/contract";
import { getExportSettings, markExported, renderPdf, saveExportSettings } from "./pdf";

/**
 * Period exports for an accountant: CSV files of invoices, payments and line items, and a zip
 * of the period's invoice PDFs. Amounts are plain decimals ("1234.50") so spreadsheets read
 * them as numbers whatever the locale's currency format.
 */

type Period = { from: string; to: string };

const money = (amount: number, currency: string) => fromMinor(amount, currency);

type Cell = string | number | null;

function invoiceRows(repos: Repositories, period: Period): Cell[][] {
	return [
		[
			"Number",
			"Status",
			"Client",
			"Issue date",
			"Due date",
			"Currency",
			"Subtotal",
			"Discount",
			"Tax",
			"Total",
			"Paid",
			"Balance",
		],
		...repos.reports
			.invoicesForExport(period)
			.map((invoice) => [
				invoice.number,
				invoice.status,
				invoice.clientName,
				invoice.issueDate,
				invoice.dueDate,
				invoice.currency,
				money(invoice.subtotal, invoice.currency),
				money(invoice.discountTotal, invoice.currency),
				money(invoice.taxTotal, invoice.currency),
				money(invoice.total, invoice.currency),
				money(invoice.amountPaid, invoice.currency),
				money(invoice.status === "void" ? 0 : invoice.total - invoice.amountPaid, invoice.currency),
			]),
	];
}

function paymentRows(repos: Repositories, period: Period): Cell[][] {
	return [
		["Date", "Invoice", "Client", "Currency", "Amount", "Method", "Note"],
		...repos.reports
			.paymentsForExport(period)
			.map((payment) => [
				payment.date,
				payment.number,
				payment.clientName,
				payment.currency,
				money(payment.amount, payment.currency),
				payment.method,
				payment.note,
			]),
	];
}

function lineItemRows(repos: Repositories, period: Period): Cell[][] {
	const rows = repos.reports
		.invoicesForExport(period)
		.flatMap((invoice) =>
			invoice.items.map((item) => [
				invoice.number,
				invoice.status,
				invoice.issueDate,
				invoice.clientName,
				item.description,
				formatQuantity(item.quantity),
				item.unit,
				money(item.unitPrice, invoice.currency),
				formatRate(item.taxRate),
				money(lineAmount(item), invoice.currency),
				invoice.currency,
			]),
		);
	return [
		[
			"Invoice",
			"Status",
			"Issue date",
			"Client",
			"Description",
			"Quantity",
			"Unit",
			"Unit price",
			"Tax %",
			"Amount",
			"Currency",
		],
		...rows,
	];
}

const CSV_LABELS = { invoices: "Invoices", payments: "Payments", items: "Line items" } as const;

async function askSavePath(title: string, defaultPath: string, extension: string) {
	const window = BrowserWindow.getFocusedWindow();
	const options = {
		title,
		defaultPath,
		filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
	};
	const result = window
		? await dialog.showSaveDialog(window, options)
		: await dialog.showSaveDialog(options);
	if (result.canceled || !result.filePath) return null;
	return result.filePath.toLowerCase().endsWith(`.${extension}`)
		? result.filePath
		: `${result.filePath}.${extension}`;
}

/** Asks where to save, then writes the export; null when cancelled. */
export async function exportReport(
	repos: Repositories,
	{ kind, from, to }: Period & { kind: ReportExportKind },
): Promise<{ path: string; count: number } | null> {
	const settings = getExportSettings(repos);
	const range = `${from} to ${to}`;

	if (kind === "pdfs") {
		// Void invoices stay out: the zip is what was actually billed.
		const invoices = repos.reports
			.invoicesForExport({ from, to })
			.filter((invoice) => invoice.status !== "void" && invoice.number);
		if (invoices.length === 0) return { path: "", count: 0 };
		const path = await askSavePath(
			"Export invoice PDFs",
			join(settings.folder, `Invoices ${range}.zip`),
			"zip",
		);
		if (!path) return null;
		const files: Record<string, Uint8Array> = {};
		for (const summary of invoices) {
			const invoice = repos.invoices.get(summary.id);
			let name = exportFileName(settings.pattern, {
				number: summary.number ?? "",
				client: summary.clientName ?? "",
				date: summary.issueDate,
			});
			for (let n = 2; files[name]; n++) name = name.replace(/( \(\d+\))?\.pdf$/i, ` (${n}).pdf`);
			files[name] = new Uint8Array(await renderPdf(invoice));
		}
		// PDFs are already compressed; storing them keeps the zip fast to write.
		writeFileSync(path, zipSync(files, { level: 0 }));
		saveExportSettings(repos, { folder: dirname(path) });
		markExported(path);
		return { path, count: invoices.length };
	}

	const rows = { invoices: invoiceRows, payments: paymentRows, items: lineItemRows }[kind](repos, {
		from,
		to,
	});
	if (rows.length === 1) return { path: "", count: 0 };
	const path = await askSavePath(
		`Export ${CSV_LABELS[kind].toLowerCase()}`,
		join(settings.folder, `${CSV_LABELS[kind]} ${range}.csv`),
		"csv",
	);
	if (!path) return null;
	writeFileSync(path, toCsv(rows), "utf8");
	saveExportSettings(repos, { folder: dirname(path) });
	markExported(path);
	return { path, count: rows.length - 1 };
}
