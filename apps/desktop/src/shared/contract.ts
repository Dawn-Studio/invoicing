import {
	type BusinessProfile,
	brandingSchema,
	type CatalogItem,
	type Client,
	type ClientImportResult,
	type ClientStats,
	catalogItemInputSchema,
	clientInputSchema,
	type DashboardReport,
	type DomainErrorCode,
	type EmailTemplates,
	INVOICE_STATUSES,
	type Invoice,
	type InvoiceEvent,
	type InvoiceSummary,
	idSchema,
	invoiceDraftInputSchema,
	isoDateSchema,
	type Payment,
	type PaymentAccount,
	type PeriodReport,
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

export const REPORT_EXPORT_KINDS = ["invoices", "payments", "items", "pdfs"] as const;
export type ReportExportKind = (typeof REPORT_EXPORT_KINDS)[number];

export type BackupReason = "daily" | "quit" | "pre-migration" | "pre-restore" | "manual";

/** One of a workspace's own backups, in its backup folder. */
export interface BackupEntry {
	/** File name; also how the renderer refers to it. */
	name: string;
	createdAt: number;
	reason: BackupReason;
	/** Bytes. */
	size: number;
}

/** What a checked backup contains, shown before the user confirms a restore. */
export interface BackupPreview {
	/** Refers to the unpacked copy waiting in main. */
	token: string;
	workspaceName: string;
	businessName: string | null;
	createdAt: number;
	reason: BackupReason;
	appVersion: string;
	clients: number;
	invoices: number;
	drafts: number;
}

/** "system" follows the OS appearance. */
export type Theme = "system" | "light" | "dark";

/** Accent colour palettes (packages/ui palettes.css); lime is the brand default. */
export const PALETTES = [
	"lime",
	"mint",
	"teal",
	"sky",
	"indigo",
	"violet",
	"rose",
	"coral",
	"amber",
	"mono",
] as const;
export type Palette = (typeof PALETTES)[number];

/**
 * Where the app is with updates. Windows and the Linux AppImage download and install updates
 * themselves ("ready" → restart). The unsigned macOS app and the .deb can't replace
 * themselves, so they get "available" with a link to the release to download.
 */
export type UpdateStatus =
	| { state: "unsupported" }
	| { state: "idle"; checkedAt: number | null }
	| { state: "checking" }
	| { state: "available"; version: string; url: string }
	| { state: "downloading"; version: string; percent: number }
	| { state: "ready"; version: string }
	| { state: "error"; message: string };

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

/** Where the assistant's model runs: the user's OpenRouter account or their ChatGPT plan. */
export const ASSISTANT_PROVIDERS = ["openrouter", "chatgpt"] as const;
export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];

export interface AssistantModel {
	id: string;
	name: string;
	/** Accepts images. */
	images: boolean;
	/** Accepts PDFs and other files. */
	files: boolean;
	contextLength: number | null;
	/** USD per million tokens; null when the provider doesn't say (ChatGPT plan). */
	price: { input: number; output: number } | null;
}

/** Everything the settings and the panel need to know about the assistant on this computer. */
export interface AssistantStatus {
	/** The provider new messages go to. */
	provider: AssistantProvider;
	/** The active provider is connected, so the assistant can be used. */
	ready: boolean;
	/** Switched on for the open workspace. */
	enabled: boolean;
	/** The user has seen what gets sent where. */
	acknowledged: boolean;
	/** The model new messages use (the active provider's pick or default). */
	model: string | null;
	openrouter: { connected: boolean; via: "oauth" | "key" | null; model: string };
	chatgpt: {
		connected: boolean;
		email: string | null;
		/** The sign-in allows using the ChatGPT plan for requests. */
		planUsage: boolean;
		model: string | null;
	};
}

/** The connected OpenRouter key's spend, in USD. */
export interface OpenRouterUsage {
	label: string;
	usage: number;
	limit: number | null;
	remaining: number | null;
	freeTier: boolean;
}

/** A file attached to a message, stored in the app's attachment folder. */
export interface AssistantAttachment {
	id: string;
	filename: string;
	mediaType: string;
	size: number;
	/** `attachment:<id>`; what the message's file part points at. */
	url: string;
}

export const MENTION_TYPES = ["client", "invoice", "item"] as const;
export type MentionType = (typeof MENTION_TYPES)[number];

/** A record the user @-mentioned; its current data goes to the model with the message. */
export interface Mention {
	type: MentionType;
	id: string;
	label: string;
	detail?: string;
}

export interface AssistantChatSummary {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

const mentionSchema = z.object({
	type: z.enum(MENTION_TYPES),
	id: idSchema,
	label: z.string().max(300),
	detail: z.string().max(300).optional(),
});

export { mentionSchema };

export const contract = {
	"app.info": { input: z.void(), output: returns<AppInfo>() },
	"preferences.theme": { input: z.void(), output: returns<Theme>() },
	"updates.status": { input: z.void(), output: returns<UpdateStatus>() },
	"updates.check": { input: z.void(), output: returns<UpdateStatus>() },
	"updates.install": { input: z.void(), output: returns<void>() },
	"updates.download": { input: z.void(), output: returns<void>() },
	"preferences.setTheme": {
		input: z.object({ theme: z.enum(["system", "light", "dark"]) }),
		output: returns<Theme>(),
	},
	"preferences.palette": { input: z.void(), output: returns<Palette>() },
	"preferences.setPalette": {
		input: z.object({ palette: z.enum(PALETTES) }),
		output: returns<Palette>(),
	},

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
				currency: z.string().length(3).optional(),
				from: isoDateSchema.optional(),
				to: isoDateSchema.optional(),
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
	/** Bulk "mark paid today"; invoices that aren't open are skipped. */
	"invoices.markPaidMany": {
		input: z.object({ ids: z.array(idSchema).min(1).max(500) }),
		output: returns<{ paid: number; skipped: number }>(),
	},
	/** Asks for a folder and writes a PDF per issued invoice; null when cancelled. */
	"invoices.exportPdfs": {
		input: z.object({ ids: z.array(idSchema).min(1).max(500) }),
		output: returns<{
			folder: string;
			firstPath: string | null;
			exported: number;
			skipped: number;
		} | null>(),
	},
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
	/** Dashboard figures in one currency (the most used one when not given). */
	"reports.dashboard": {
		input: z.object({ currency: z.string().length(3).optional() }).optional(),
		output: returns<DashboardReport>(),
	},
	/** Revenue per client and the tax summary for a period. */
	"reports.period": {
		input: z.object({
			currency: z.string().length(3).optional(),
			from: isoDateSchema,
			to: isoDateSchema,
		}),
		output: returns<PeriodReport>(),
	},
	/** CSV of the period's invoices, payments or line items, or a zip of its PDFs; null when cancelled. */
	"reports.export": {
		input: z.object({ kind: z.enum(REPORT_EXPORT_KINDS), from: isoDateSchema, to: isoDateSchema }),
		output: returns<{ path: string; count: number } | null>(),
	},
	/** The open workspace's backups, newest first. */
	"backups.list": { input: z.void(), output: returns<BackupEntry[]>() },
	"backups.create": { input: z.void(), output: returns<BackupEntry[]>() },
	/** Asks where to save a backup file of the open workspace; null when cancelled. */
	"backups.export": { input: z.void(), output: returns<{ path: string } | null>() },
	/**
	 * Checks and unpacks a backup for restoring: one of the workspace's own (by name), or a
	 * file the user picks (no name). Null when the file dialog is cancelled.
	 */
	"backups.inspect": {
		input: z.object({ name: z.string().max(200).optional() }),
		output: returns<BackupPreview | null>(),
	},
	"backups.restore": {
		input: z.object({ token: z.string().max(100), mode: z.enum(["new", "replace"]) }),
		output: returns<WorkspaceList>(),
	},
	"backups.discard": { input: z.object({ token: z.string().max(100) }), output: returns<void>() },
	/** Opens the app's data folder (databases, logos, backups) in Finder / Explorer. */
	"app.showDataFolder": { input: z.void(), output: returns<void>() },
	"assistant.status": { input: z.void(), output: returns<AssistantStatus>() },
	/** Opens OpenRouter in the browser and waits for the user to connect. */
	"assistant.connectOpenRouter": { input: z.void(), output: returns<AssistantStatus>() },
	"assistant.setOpenRouterKey": {
		input: z.object({ key: z.string().trim().min(10, "Paste your OpenRouter key").max(300) }),
		output: returns<AssistantStatus>(),
	},
	"assistant.openRouterUsage": { input: z.void(), output: returns<OpenRouterUsage | null>() },
	/** Opens "Sign in with ChatGPT" in the browser and waits. */
	"assistant.connectChatGpt": { input: z.void(), output: returns<AssistantStatus>() },
	/** Stops a browser sign-in that's still waiting. */
	"assistant.cancelSignIn": { input: z.void(), output: returns<void>() },
	"assistant.disconnect": {
		input: z.object({ provider: z.enum(ASSISTANT_PROVIDERS) }),
		output: returns<AssistantStatus>(),
	},
	"assistant.setProvider": {
		input: z.object({ provider: z.enum(ASSISTANT_PROVIDERS) }),
		output: returns<AssistantStatus>(),
	},
	"assistant.models": {
		input: z.object({ provider: z.enum(ASSISTANT_PROVIDERS) }),
		output: returns<AssistantModel[]>(),
	},
	"assistant.setModel": {
		input: z.object({ provider: z.enum(ASSISTANT_PROVIDERS), model: z.string().min(1).max(200) }),
		output: returns<AssistantStatus>(),
	},
	/** Turns the assistant on or off for the open workspace. */
	"assistant.setEnabled": {
		input: z.object({ enabled: z.boolean() }),
		output: returns<AssistantStatus>(),
	},
	"assistant.acknowledge": { input: z.void(), output: returns<AssistantStatus>() },
	"assistant.chats": { input: z.void(), output: returns<AssistantChatSummary[]>() },
	/** A conversation's messages (AI SDK UI messages). */
	"assistant.chat": {
		input: byId,
		output: returns<{ id: string; title: string; messages: unknown[] } | null>(),
	},
	"assistant.renameChat": {
		input: byId.extend({ title: z.string().trim().min(1).max(120) }),
		output: returns<void>(),
	},
	"assistant.deleteChat": { input: byId, output: returns<void>() },
	"assistant.deleteChats": { input: z.void(), output: returns<void>() },
	/** Stores a file the user attached; `data` is base64. */
	"assistant.saveAttachment": {
		input: z.object({
			filename: z.string().trim().min(1).max(255),
			mediaType: z.string().max(120),
			data: z.base64().max(28_000_000, "Files can be up to 20 MB"),
		}),
		output: returns<AssistantAttachment>(),
	},
	/** An attachment as a data URL, for previews. */
	"assistant.attachment": {
		input: z.object({ id: z.string().max(80) }),
		output: returns<string | null>(),
	},
	/** Records for the @ menu. */
	"assistant.mentions": {
		input: z.object({ search: z.string().max(200).optional() }),
		output: returns<Mention[]>(),
	},
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
