import { app, shell } from "electron";
import {
	askBackupDestination,
	askBackupFile,
	backupPath,
	discardStaged,
	listBackups,
	stageBackup,
} from "./backups";
import { getEmailTemplates, prepareEmail, saveEmailTemplates } from "./email";
import { chooseCsvFile, chooseLogo, logoDataUrl } from "./files";
import {
	chooseExportFolder,
	exportPdf,
	exportPdfs,
	getExportSettings,
	markExported,
	printInvoice,
	revealExported,
	saveExportSettings,
} from "./pdf";
import { exportReport } from "./reports";
import type { Handlers } from "./rpc";
import type { WorkspaceManager } from "./workspaces";

export function createHandlers(workspaces: WorkspaceManager): Handlers {
	// Always the open workspace's repositories; switching workspaces replaces them.
	const repos = () => workspaces.repos;
	/** Reports open in the profile's currency until there are invoices to pick from. */
	const fallbackCurrency = () => repos().profile.get()?.defaultCurrency ?? "USD";
	return {
		"app.info": () => ({
			name: app.getName(),
			version: app.getVersion(),
			dataPath: workspaces.databasePath,
		}),

		"workspaces.list": () => workspaces.list(),
		"workspaces.create": ({ name }) => workspaces.create(name),
		"workspaces.switch": ({ id }) => workspaces.switchTo(id),
		"workspaces.rename": ({ id, name }) => workspaces.rename(id, name),
		"workspaces.delete": ({ id }) => workspaces.remove(id),

		"profile.get": () => repos().profile.get(),
		"profile.save": (input) => repos().profile.save(input),
		"profile.chooseLogo": async () => {
			if (!repos().profile.get()) return null;
			const fileName = await chooseLogo();
			return fileName ? repos().profile.setLogoFile(fileName) : null;
		},
		"profile.saveBranding": (input) => repos().profile.setBranding(input),
		"profile.removeLogo": () => repos().profile.setLogoFile(null),
		"profile.logo": () => {
			const fileName = repos().profile.get()?.logoFile;
			return fileName ? logoDataUrl(fileName) : null;
		},
		"logos.get": ({ fileName }) => logoDataUrl(fileName),

		"clients.list": (input) => repos().clients.list(input),
		"clients.get": ({ id }) => repos().clients.get(id),
		"clients.create": (input) => repos().clients.create(input),
		"clients.update": ({ id, data }) => repos().clients.update(id, data),
		"clients.archive": ({ id }) => repos().clients.archive(id),
		"clients.unarchive": ({ id }) => repos().clients.unarchive(id),
		"clients.stats": ({ id }) => repos().clients.stats(id),
		"clients.chooseImportFile": () => chooseCsvFile(),
		"clients.import": ({ clients }) => repos().clients.importMany(clients),

		"paymentAccounts.list": (input) => repos().paymentAccounts.list(input),
		"paymentAccounts.create": (input) => repos().paymentAccounts.create(input),
		"paymentAccounts.update": ({ id, data }) => repos().paymentAccounts.update(id, data),
		"paymentAccounts.archive": ({ id }) => repos().paymentAccounts.archive(id),

		"taxRates.list": (input) => repos().taxRates.list(input),
		"taxRates.create": (input) => repos().taxRates.create(input),
		"taxRates.update": ({ id, data }) => repos().taxRates.update(id, data),
		"taxRates.archive": ({ id }) => repos().taxRates.archive(id),

		"catalog.list": (input) => repos().catalog.list(input),
		"catalog.create": (input) => repos().catalog.create(input),
		"catalog.update": ({ id, data }) => repos().catalog.update(id, data),
		"catalog.archive": ({ id }) => repos().catalog.archive(id),
		"catalog.unarchive": ({ id }) => repos().catalog.unarchive(id),

		"invoices.list": (input) => repos().invoices.list(input),
		"invoices.get": ({ id }) => repos().invoices.get(id),
		"invoices.events": ({ id }) => repos().invoices.events(id),
		"invoices.createDraft": (input) => repos().invoices.createDraft(input),
		"invoices.updateDraft": ({ id, data }) => repos().invoices.updateDraft(id, data),
		"invoices.deleteDraft": ({ id }) => repos().invoices.deleteDraft(id),
		"invoices.duplicate": ({ id }) => repos().invoices.duplicate(id),
		"invoices.issue": ({ id }) => repos().invoices.issue(id),
		"invoices.payments": ({ id }) => repos().invoices.payments(id),
		"invoices.recordPayment": ({ id, data }) => repos().invoices.recordPayment(id, data),
		"invoices.removePayment": ({ id }) => repos().invoices.removePayment(id),
		"invoices.markPaid": ({ id }) => repos().invoices.markPaid(id),
		"invoices.exportPdf": ({ id }) => exportPdf(repos(), id),
		"invoices.exportPdfs": ({ ids }) => exportPdfs(repos(), ids),
		"invoices.markPaidMany": ({ ids }) => repos().invoices.markPaidMany(ids),
		"invoices.print": ({ id }) => printInvoice(repos(), id),

		"invoices.email": ({ id, ...request }) => prepareEmail(repos(), { id, ...request }),
		"invoices.markSent": ({ id, to, reminder }) =>
			repos().invoices.recordSent(id, { to, reminder }),
		"emailTemplates.get": () => getEmailTemplates(repos()),
		"emailTemplates.save": (templates) => saveEmailTemplates(repos(), templates),

		"exportSettings.get": () => getExportSettings(repos()),
		"exportSettings.save": ({ pattern }) => saveExportSettings(repos(), { pattern }),
		"exportSettings.chooseFolder": () => chooseExportFolder(repos()),
		"files.reveal": ({ path }) => revealExported(path),
		"reports.dashboard": (input) =>
			repos().reports.dashboard({ currency: input?.currency, fallback: fallbackCurrency() }),
		"reports.period": (input) => repos().reports.period({ ...input, fallback: fallbackCurrency() }),
		"reports.export": (input) => exportReport(repos(), input),
		"backups.list": () => listBackups(workspaces.active.id),
		"backups.create": () => {
			workspaces.backupNow("manual");
			return listBackups(workspaces.active.id);
		},
		"backups.export": async () => {
			const path = await askBackupDestination(workspaces.active.name);
			if (!path) return null;
			workspaces.exportBackup(path);
			markExported(path);
			return { path };
		},
		"backups.inspect": async ({ name }) => {
			const file = name ? backupPath(workspaces.active.id, name) : await askBackupFile();
			return file ? stageBackup(file) : null;
		},
		"backups.restore": ({ token, mode }) => workspaces.restore(token, mode),
		"backups.discard": ({ token }) => discardStaged(token),
		"app.showDataFolder": async () => {
			const error = await shell.openPath(app.getPath("userData"));
			if (error) throw new Error(error);
		},
		"invoices.void": ({ id, reason }) => repos().invoices.void(id, reason),
	};
}
