import type { Repositories } from "@dawnstudio/db";
import { app } from "electron";
import { databasePath } from "./database";
import { chooseCsvFile, chooseLogo, logoDataUrl } from "./files";
import type { Handlers } from "./rpc";

export function createHandlers(repos: Repositories): Handlers {
	return {
		"app.info": () => ({
			name: app.getName(),
			version: app.getVersion(),
			dataPath: databasePath(),
		}),

		"profile.get": () => repos.profile.get(),
		"profile.save": (input) => repos.profile.save(input),
		"profile.chooseLogo": async () => {
			if (!repos.profile.get()) return null;
			const fileName = await chooseLogo();
			return fileName ? repos.profile.setLogoFile(fileName) : null;
		},
		"profile.removeLogo": () => repos.profile.setLogoFile(null),
		"profile.logo": () => {
			const fileName = repos.profile.get()?.logoFile;
			return fileName ? logoDataUrl(fileName) : null;
		},
		"logos.get": ({ fileName }) => logoDataUrl(fileName),

		"clients.list": (input) => repos.clients.list(input),
		"clients.get": ({ id }) => repos.clients.get(id),
		"clients.create": (input) => repos.clients.create(input),
		"clients.update": ({ id, data }) => repos.clients.update(id, data),
		"clients.archive": ({ id }) => repos.clients.archive(id),
		"clients.unarchive": ({ id }) => repos.clients.unarchive(id),
		"clients.stats": ({ id }) => repos.clients.stats(id),
		"clients.chooseImportFile": () => chooseCsvFile(),
		"clients.import": ({ clients }) => repos.clients.importMany(clients),

		"paymentAccounts.list": (input) => repos.paymentAccounts.list(input),
		"paymentAccounts.create": (input) => repos.paymentAccounts.create(input),
		"paymentAccounts.update": ({ id, data }) => repos.paymentAccounts.update(id, data),
		"paymentAccounts.archive": ({ id }) => repos.paymentAccounts.archive(id),

		"taxRates.list": (input) => repos.taxRates.list(input),
		"taxRates.create": (input) => repos.taxRates.create(input),
		"taxRates.update": ({ id, data }) => repos.taxRates.update(id, data),
		"taxRates.archive": ({ id }) => repos.taxRates.archive(id),

		"invoices.list": (input) => repos.invoices.list(input),
		"invoices.get": ({ id }) => repos.invoices.get(id),
		"invoices.events": ({ id }) => repos.invoices.events(id),
		"invoices.createDraft": (input) => repos.invoices.createDraft(input),
		"invoices.updateDraft": ({ id, data }) => repos.invoices.updateDraft(id, data),
		"invoices.deleteDraft": ({ id }) => repos.invoices.deleteDraft(id),
		"invoices.duplicate": ({ id }) => repos.invoices.duplicate(id),
		"invoices.issue": ({ id }) => repos.invoices.issue(id),
		"invoices.markPaid": ({ id, paidAt }) => repos.invoices.markPaid(id, paidAt),
		"invoices.markUnpaid": ({ id }) => repos.invoices.markUnpaid(id),
		"invoices.void": ({ id, reason }) => repos.invoices.void(id, reason),
	};
}
