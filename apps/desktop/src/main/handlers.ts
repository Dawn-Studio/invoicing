import { formatMoney } from "@dawnstudio/core";
import { app, shell } from "electron";
import type { Mention } from "../shared/contract";
import type { Assistant } from "./assistant";
import { attachmentDataUrl, saveAttachment } from "./assistant/attachments";
import { loadCredentials } from "./assistant/credentials";
import { cancelSignIn } from "./assistant/loopback";
import { openRouterUsage } from "./assistant/openrouter";
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
import {
	getPalette,
	getStartScreen,
	getTheme,
	setPalette,
	setStartScreen,
	setTheme,
} from "./preferences";
import { exportReport } from "./reports";
import type { Handlers } from "./rpc";
import type { Updates } from "./updates";
import type { WorkspaceManager } from "./workspaces";

export function createHandlers(
	workspaces: WorkspaceManager,
	{
		onThemeChanged,
		updates,
		assistant,
	}: { onThemeChanged: () => void; updates: Updates; assistant: Assistant },
): Handlers {
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

		"preferences.theme": () => getTheme(),
		"preferences.setTheme": ({ theme }) => {
			setTheme(theme);
			onThemeChanged();
			return theme;
		},
		"updates.status": () => updates.status,
		"updates.check": () => updates.check(),
		"updates.install": () => updates.install(),
		"updates.download": () => updates.openDownload(),
		"preferences.palette": () => getPalette(),
		"preferences.startScreen": () => getStartScreen(),
		"preferences.setStartScreen": ({ screen }) => {
			setStartScreen(screen);
			return screen;
		},
		"preferences.setPalette": ({ palette }) => {
			setPalette(palette);
			return palette;
		},

		"workspaces.list": () => workspaces.list(),
		"workspaces.create": ({ name }) => workspaces.create(name),
		"workspaces.switch": ({ id }) => workspaces.switchTo(id),
		"workspaces.rename": ({ id, name }) => workspaces.rename(id, name),
		"workspaces.chooseAvatar": async ({ id }) => {
			const fileName = await chooseLogo("Choose a workspace avatar");
			return fileName ? workspaces.setAvatar(id, fileName) : null;
		},
		"workspaces.removeAvatar": ({ id }) => workspaces.setAvatar(id, null),
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

		"assistant.status": () => assistant.status(),
		"assistant.connectOpenRouter": () => assistant.connect("openrouter"),
		"assistant.setOpenRouterKey": ({ key }) => assistant.connect("openrouter", key),
		"assistant.openRouterUsage": async () => {
			await loadCredentials();
			return openRouterUsage();
		},
		"assistant.connectChatGpt": () => assistant.connect("chatgpt"),
		"assistant.cancelSignIn": () => cancelSignIn(),
		"assistant.disconnect": ({ provider }) => assistant.disconnect(provider),
		"assistant.setProvider": ({ provider }) => assistant.setProvider(provider),
		"assistant.models": ({ provider }) => assistant.models(provider),
		"assistant.setModel": ({ provider, model }) => assistant.setModel(provider, model),
		"assistant.setEnabled": ({ enabled }) => assistant.setEnabled(enabled),
		"assistant.acknowledge": () => assistant.acknowledge(),
		"assistant.setAutoApprove": ({ autoApprove }) => assistant.setAutoApprove(autoApprove),
		"assistant.chats": () => repos().assistantChats.list(),
		"assistant.chat": ({ id }) => {
			const chat = repos().assistantChats.find(id);
			return chat ? { id: chat.id, title: chat.title, messages: chat.messages } : null;
		},
		"assistant.renameChat": ({ id, title }) => {
			repos().assistantChats.rename(id, title);
		},
		"assistant.deleteChat": ({ id }) => repos().assistantChats.delete(id),
		"assistant.deleteChats": () => repos().assistantChats.deleteAll(),
		"assistant.saveAttachment": (input) => saveAttachment(input),
		"assistant.attachment": ({ id }) => attachmentDataUrl(id),
		"assistant.mentions": ({ search }) => {
			const term = search?.trim() || undefined;
			const clients: Mention[] = repos()
				.clients.list({ search: term })
				.slice(0, 6)
				.map((client) => ({
					type: "client",
					id: client.id,
					label: client.name,
					detail: client.email || undefined,
				}));
			const invoices: Mention[] = repos()
				.invoices.list({ search: term })
				.slice(0, 6)
				.map((invoice) => ({
					type: "invoice",
					id: invoice.id,
					label: invoice.number ?? "Draft",
					detail: [invoice.clientName, formatMoney(invoice.total, invoice.currency)]
						.filter(Boolean)
						.join(" · "),
				}));
			const items: Mention[] = repos()
				.catalog.list({ search: term })
				.slice(0, 6)
				.map((item) => ({
					type: "item",
					id: item.id,
					label: item.description,
					detail: formatMoney(item.unitPrice, item.currency),
				}));
			return [...clients, ...invoices, ...items];
		},
	};
}
