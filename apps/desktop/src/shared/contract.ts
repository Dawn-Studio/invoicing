import {
	type BusinessProfile,
	type Client,
	type ClientImportResult,
	type ClientStats,
	clientInputSchema,
	type DomainErrorCode,
	INVOICE_STATUSES,
	type Invoice,
	type InvoiceEvent,
	type InvoiceSummary,
	idSchema,
	invoiceDraftInputSchema,
	type PaymentAccount,
	paymentAccountInputSchema,
	profileInputSchema,
	type TaxRate,
	taxRateInputSchema,
} from "@dawnstudio/core";
import { z } from "zod";

/**
 * The single source of truth for what the renderer may ask the main process to do.
 * Each procedure has a zod schema (validated in main) and an output type. The renderer
 * imports this file for types only, so the schemas never ship in the renderer bundle.
 */

/** Marks a procedure's return type; the value itself is never used at runtime. */
const returns = <T>() => undefined as unknown as T;

const byId = z.object({ id: idSchema });

export interface AppInfo {
	name: string;
	version: string;
	dataPath: string;
}

export const contract = {
	"app.info": { input: z.void(), output: returns<AppInfo>() },

	"profile.get": { input: z.void(), output: returns<BusinessProfile | null>() },
	"profile.save": { input: profileInputSchema, output: returns<BusinessProfile>() },
	/** Opens a file dialog; null when cancelled. */
	"profile.chooseLogo": { input: z.void(), output: returns<BusinessProfile | null>() },
	"profile.removeLogo": { input: z.void(), output: returns<BusinessProfile | null>() },
	/** The current logo as a data URL. */
	"profile.logo": { input: z.void(), output: returns<string | null>() },

	"clients.list": {
		input: z
			.object({ search: z.string().max(200).optional(), includeArchived: z.boolean().optional() })
			.optional(),
		output: returns<Client[]>(),
	},
	"clients.get": { input: byId, output: returns<Client>() },
	"clients.create": { input: clientInputSchema, output: returns<Client>() },
	"clients.update": { input: byId.extend({ data: clientInputSchema }), output: returns<Client>() },
	"clients.archive": { input: byId, output: returns<Client>() },
	"clients.unarchive": { input: byId, output: returns<Client>() },
	"clients.stats": { input: byId, output: returns<ClientStats>() },
	/** Opens a file dialog and returns the CSV text; null when cancelled. */
	"clients.chooseImportFile": {
		input: z.void(),
		output: returns<{ fileName: string; text: string } | null>(),
	},
	"clients.import": {
		input: z.object({ clients: z.array(clientInputSchema).min(1).max(5000) }),
		output: returns<ClientImportResult>(),
	},

	"paymentAccounts.list": {
		input: z.object({ includeArchived: z.boolean().optional() }).optional(),
		output: returns<PaymentAccount[]>(),
	},
	"paymentAccounts.create": { input: paymentAccountInputSchema, output: returns<PaymentAccount>() },
	"paymentAccounts.update": {
		input: byId.extend({ data: paymentAccountInputSchema }),
		output: returns<PaymentAccount>(),
	},
	"paymentAccounts.archive": { input: byId, output: returns<PaymentAccount>() },

	"taxRates.list": {
		input: z.object({ includeArchived: z.boolean().optional() }).optional(),
		output: returns<TaxRate[]>(),
	},
	"taxRates.create": { input: taxRateInputSchema, output: returns<TaxRate>() },
	"taxRates.update": {
		input: byId.extend({ data: taxRateInputSchema }),
		output: returns<TaxRate>(),
	},
	"taxRates.archive": { input: byId, output: returns<TaxRate>() },

	"invoices.list": {
		input: z
			.object({
				status: z.array(z.enum(INVOICE_STATUSES)).optional(),
				clientId: idSchema.optional(),
				search: z.string().max(200).optional(),
			})
			.optional(),
		output: returns<InvoiceSummary[]>(),
	},
	"invoices.get": { input: byId, output: returns<Invoice>() },
	"invoices.events": { input: byId, output: returns<InvoiceEvent[]>() },
	"invoices.createDraft": {
		input: z.object({ clientId: idSchema.nullable().optional() }).optional(),
		output: returns<Invoice>(),
	},
	"invoices.updateDraft": {
		input: byId.extend({ data: invoiceDraftInputSchema }),
		output: returns<Invoice>(),
	},
	"invoices.deleteDraft": { input: byId, output: returns<void>() },
	"invoices.duplicate": { input: byId, output: returns<Invoice>() },
	"invoices.issue": { input: byId, output: returns<Invoice>() },
	"invoices.markPaid": {
		input: byId.extend({ paidAt: z.int().optional() }),
		output: returns<Invoice>(),
	},
	"invoices.markUnpaid": { input: byId, output: returns<Invoice>() },
	"invoices.void": {
		input: byId.extend({ reason: z.string().max(500).optional() }),
		output: returns<Invoice>(),
	},
} satisfies Record<string, { input: z.ZodType; output: unknown }>;

export type Contract = typeof contract;
export type Channel = keyof Contract;
/** What callers send (before zod defaults/transforms). */
export type Input<C extends Channel> = z.input<Contract[C]["input"]>;
/** What handlers receive (after validation). */
export type ParsedInput<C extends Channel> = z.output<Contract[C]["input"]>;
export type Output<C extends Channel> = Contract[C]["output"];

export type RpcErrorCode = DomainErrorCode | "INTERNAL";

export type RpcResult<T> =
	| { ok: true; value: T }
	| {
			ok: false;
			error: { code: RpcErrorCode; message: string; issues?: { path: string; message: string }[] };
	  };
