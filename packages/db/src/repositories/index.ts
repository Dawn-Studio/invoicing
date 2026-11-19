import type { Db } from "../database";
import { catalogRepository } from "./catalog";
import { clientRepository } from "./clients";
import { createContext, type RepositoryContext } from "./context";
import { invoiceRepository } from "./invoices";
import { paymentAccountRepository } from "./payment-accounts";
import { profileRepository } from "./profile";
import { reportRepository } from "./reports";
import { settingsRepository } from "./settings";
import { taxRateRepository } from "./tax-rates";

export function createRepositories(db: Db, overrides?: Partial<Omit<RepositoryContext, "db">>) {
	const ctx = createContext(db, overrides);
	return {
		profile: profileRepository(ctx),
		clients: clientRepository(ctx),
		paymentAccounts: paymentAccountRepository(ctx),
		taxRates: taxRateRepository(ctx),
		catalog: catalogRepository(ctx),
		invoices: invoiceRepository(ctx),
		settings: settingsRepository(ctx),
		reports: reportRepository(ctx),
	};
}

export type Repositories = ReturnType<typeof createRepositories>;
export type { CatalogListOptions } from "./catalog";
export type { ClientListOptions } from "./clients";
export type { InvoiceListOptions } from "./invoices";
export type { ExportInvoice, ExportPayment } from "./reports";
export { lastMonths } from "./reports";
