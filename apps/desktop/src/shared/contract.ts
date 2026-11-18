import {
	type BusinessProfile,
	brandingSchema,
	type CatalogItem,
	type Client,
	type ClientImportResult,
	type ClientStats,
	catalogItemInputSchema,
	clientInputSchema,
	type DomainErrorCode,
	type EmailTemplates,
	INVOICE_STATUSES,
	type Invoice,
	type InvoiceEvent,
	type InvoiceSummary,
	idSchema,
	invoiceDraftInputSchema,
	type Payment,
	type PaymentAccount,
	paymentAccountInputSchema,
	paymentInputSchema,
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

const templateSchema = z.object({
	subject: z.string().trim().min(1, "Add a subject").max(300),
	body: z.string().max(10_000),
});
const emailTemplatesSchema = z.object({ invoice: templateSchema, reminder: templateSchema });

/** Marks a procedure's return type; the value itself is never used at runtime. */
const returns = <T>() => undefined as unknown as T;

const byId = z.object({ id: idSchema });

export interface ExportSettings {
	/** PDF file name pattern, e.g. "{number} {client}". */
	pattern: string;
	/** Folder the save dialog opens in. */
	folder: string;
}

export interface AppInfo {
	name: string;
	version: string;
	dataPath: string;
}

/** A separate business with its own profile, clients and invoices. */
export interface Workspace {
	id: string;
	name: string;
	createdAt: number;
}

export interface WorkspaceList {
	activeId: string;
	workspaces: Workspace[];
}

const workspaceName = z.string().trim().min(1, "Name is required").max(60);

export const contract = {
	"app.info": { input: z.void(), output: returns<AppInfo>() },

	"workspaces.list": { input: z.void(), output: returns<WorkspaceList>() },
	/** Creates an empty workspace and opens it. */
	"workspaces.create": {
		input: z.object({ name: workspaceName }),
		output: returns<Workspace>(),
	},
	"workspaces.switch": { input: byId, output: returns<WorkspaceList>() },
	"workspaces.rename": {
		input: byId.extend({ name: workspaceName }),
		output: returns<Workspace>(),
	},
	/** Moves the workspace's data file to the Trash. */
	"workspaces.delete": { input: byId, output: returns<WorkspaceList>() },

	"profile.get": { input: z.void(), output: returns<BusinessProfile | null>() },
	"profile.save": { input: profileInputSchema, output: returns<BusinessProfile>() },
	/** Opens a file dialog; null when cancelled. */
	"profile.chooseLogo": { input: z.void(), output: returns<BusinessProfile | null>() },
	"profile.saveBranding": { input: brandingSchema, output: returns<BusinessProfile>() },
	"profile.removeLogo": { input: z.void(), output: returns<BusinessProfile | null>() },
	/** The current logo as a data URL. */
	"profile.logo": { input: z.void(), output: returns<string | null>() },
	/** A stored logo by file name (issued invoices keep the one they were issued with). */
	"logos.get": {
		input: z.object({ fileName: z.string().max(64) }),
		output: returns<string | null>(),
	},

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

	"catalog.list": {
		input: z
			.object({ search: z.string().max(200).optional(), includeArchived: z.boolean().optional() })
			.optional(),
		output: returns<CatalogItem[]>(),
	},
	"catalog.create": { input: catalogItemInputSchema, output: returns<CatalogItem>() },
	"catalog.update": {
		input: byId.extend({ data: catalogItemInputSchema }),
		output: returns<CatalogItem>(),
	},
	"catalog.archive": { input: byId, output: returns<CatalogItem>() },
	"catalog.unarchive": { input: byId, output: returns<CatalogItem>() },

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
	"invoices.payments": { input: byId, output: returns<Payment[]>() },
	"invoices.recordPayment": {
		input: byId.extend({ data: paymentInputSchema }),
		output: returns<Invoice>(),
	},
	/** `id` is the payment's. */
	"invoices.removePayment": { input: byId, output: returns<Invoice>() },
	/** One payment for the whole balance, dated today. */
	"invoices.markPaid": { input: byId, output: returns<Invoice>() },
	/** Renders the PDF and asks where to save it; null when cancelled. */
	"invoices.exportPdf": {
		input: byId,
		output: returns<{ path: string; fileName: string } | null>(),
	},
	/** Opens the system print dialog; false when cancelled. */
	"invoices.print": { input: byId, output: returns<boolean>() },

	/** Opens an email with the PDF: an Apple Mail draft, or the default app via mailto. */
	"invoices.email": {
		input: byId.extend({
			to: z.email("Enter a valid email"),
			cc: z.array(z.email()).max(20),
			subject: z.string().trim().min(1, "Add a subject").max(300),
			body: z.string().max(10_000),
			app: z.enum(["mail", "default"]),
		}),
		output: returns<{ fileName: string }>(),
	},
	/** Confirms the email went out; records it in the activity. */
	"invoices.markSent": {
		input: byId.extend({ to: z.string().max(320), reminder: z.boolean() }),
		output: returns<void>(),
	},

	"emailTemplates.get": { input: z.void(), output: returns<EmailTemplates>() },
	"emailTemplates.save": { input: emailTemplatesSchema, output: returns<EmailTemplates>() },

	"exportSettings.get": { input: z.void(), output: returns<ExportSettings>() },
	"exportSettings.save": {
		input: z.object({ pattern: z.string().max(100) }),
		output: returns<ExportSettings>(),
	},
	/** Folder picker; null when cancelled. */
	"exportSettings.chooseFolder": { input: z.void(), output: returns<ExportSettings | null>() },
	/** Shows an exported file in Finder / Explorer. */
	"files.reveal": { input: z.object({ path: z.string().max(4096) }), output: returns<void>() },
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
