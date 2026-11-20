import { DomainError, todayIso } from "@dawnstudio/core";
import type { Repositories } from "@dawnstudio/db";
import {
	convertToModelMessages,
	isStepCount,
	type LanguageModel,
	streamText,
	toUIMessageStream,
	type UIMessage,
	validateUIMessages,
} from "ai";
import { ipcMain } from "electron";
import { z } from "zod";
import {
	ASSISTANT_ABORT_CHANNEL,
	ASSISTANT_SEND_CHANNEL,
	ASSISTANT_STREAM_CHANNEL,
	type AssistantRequest,
	type AssistantScreen,
	type AssistantStreamEvent,
} from "../../shared/api";
import {
	type AssistantProvider,
	type AssistantStatus,
	type Mention,
	mentionSchema,
} from "../../shared/contract";
import { getAssistantPreferences, setAssistantPreferences } from "../preferences";
import { isTrustedSender } from "../rpc";
import type { WorkspaceManager } from "../workspaces";
import { isTextType, readAttachment } from "./attachments";
import {
	CHATGPT_PROVIDER_OPTIONS,
	chatGptModel,
	chatGptModels,
	chatGptPlanUsage,
	connectChatGpt,
	disconnectChatGpt,
} from "./chatgpt";
import { loadCredentials, readCredentials } from "./credentials";
import { describeError } from "./errors";
import {
	connectOpenRouter,
	DEFAULT_OPENROUTER_MODEL,
	disconnectOpenRouter,
	openRouterModel,
	openRouterModels,
	setOpenRouterKey,
} from "./openrouter";
import { createTools, describeRecord, WRITE_TOOLS } from "./tools";

const ENABLED_KEY = "assistant.enabled";

/** What a user message carries besides its text: the records they @-mentioned. */
const metadataSchema = z
	.object({ mentions: z.array(mentionSchema).max(20).optional() })
	.loose()
	.optional();

const requestSchema = z.object({
	requestId: z.string().min(1).max(100),
	chatId: z.uuid(),
	messages: z.array(z.unknown()).min(1).max(500),
	screen: z
		.object({ type: z.enum(["invoice", "client"]), id: z.string().max(64) })
		.nullable()
		.default(null),
});

/**
 * The assistant: provider connections, the model, and streaming replies to the window.
 * Replies run here in the main process, so provider keys and tokens never reach the page;
 * the page gets AI SDK UI message chunks over IPC and renders them with `useChat`.
 */
export class Assistant {
	private readonly running = new Map<string, AbortController>();

	constructor(private readonly workspaces: WorkspaceManager) {}

	async status(): Promise<AssistantStatus> {
		await loadCredentials();
		const prefs = getAssistantPreferences();
		const credentials = readCredentials();
		const planUsage = chatGptPlanUsage();
		const openrouterModel = prefs.models.openrouter ?? DEFAULT_OPENROUTER_MODEL;
		const ready =
			prefs.provider === "openrouter"
				? Boolean(credentials.openrouter)
				: Boolean(credentials.chatgpt) && planUsage;
		return {
			provider: prefs.provider,
			ready,
			enabled: this.workspaces.repos.settings.get<boolean>(ENABLED_KEY) ?? true,
			acknowledged: prefs.acknowledged,
			model: prefs.provider === "openrouter" ? openrouterModel : prefs.models.chatgpt,
			openrouter: {
				connected: Boolean(credentials.openrouter),
				via: credentials.openrouter?.via ?? null,
				model: openrouterModel,
			},
			chatgpt: {
				connected: Boolean(credentials.chatgpt),
				email: credentials.chatgpt?.email ?? null,
				planUsage,
				model: prefs.models.chatgpt,
			},
		};
	}

	async connect(provider: AssistantProvider, key?: string) {
		await loadCredentials();
		if (provider === "openrouter") {
			if (key) await setOpenRouterKey(key);
			else await connectOpenRouter();
		} else {
			await connectChatGpt();
		}
		// Connecting is a choice: use what was just connected.
		setAssistantPreferences({ provider });
		return this.status();
	}

	async disconnect(provider: AssistantProvider) {
		await loadCredentials();
		if (provider === "openrouter") await disconnectOpenRouter();
		else await disconnectChatGpt();
		const other: AssistantProvider = provider === "openrouter" ? "chatgpt" : "openrouter";
		const credentials = readCredentials();
		if (getAssistantPreferences().provider === provider && credentials[other]) {
			setAssistantPreferences({ provider: other });
		}
		return this.status();
	}

	setProvider(provider: AssistantProvider) {
		setAssistantPreferences({ provider });
		return this.status();
	}

	async models(provider: AssistantProvider) {
		await loadCredentials();
		return provider === "openrouter" ? openRouterModels() : chatGptModels();
	}

	setModel(provider: AssistantProvider, model: string) {
		const { models } = getAssistantPreferences();
		setAssistantPreferences({ models: { ...models, [provider]: model } });
		return this.status();
	}

	setEnabled(enabled: boolean) {
		this.workspaces.repos.settings.set(ENABLED_KEY, enabled);
		return this.status();
	}

	acknowledge() {
		setAssistantPreferences({ acknowledged: true });
		return this.status();
	}

	/** Listens for replies the window asks for, and unlocks the stored credentials. */
	register() {
		void loadCredentials();
		ipcMain.on(ASSISTANT_SEND_CHANNEL, (event, raw: unknown) => {
			if (!isTrustedSender(event)) return;
			const parsed = requestSchema.safeParse(raw);
			const requestId =
				typeof (raw as { requestId?: unknown })?.requestId === "string"
					? (raw as { requestId: string }).requestId
					: "";
			const send = (message: AssistantStreamEvent) => {
				if (!event.sender.isDestroyed()) event.sender.send(ASSISTANT_STREAM_CHANNEL, message);
			};
			if (!parsed.success) {
				send({ requestId, type: "error", message: "That message couldn't be sent." });
				return;
			}
			void this.reply(parsed.data, send);
		});
		ipcMain.on(ASSISTANT_ABORT_CHANNEL, (event, requestId: unknown) => {
			if (!isTrustedSender(event) || typeof requestId !== "string") return;
			this.running.get(requestId)?.abort();
		});
	}

	private async model(): Promise<{
		model: LanguageModel;
		options?: typeof CHATGPT_PROVIDER_OPTIONS;
	}> {
		const status = await this.status();
		if (status.provider === "openrouter") {
			if (!status.openrouter.connected) {
				throw new DomainError("VALIDATION", "Connect OpenRouter in Settings → Assistant first.");
			}
			return { model: openRouterModel(status.openrouter.model) };
		}
		if (!status.chatgpt.connected) {
			throw new DomainError("VALIDATION", "Sign in with ChatGPT in Settings → Assistant first.");
		}
		if (!status.chatgpt.planUsage) {
			throw new DomainError(
				"VALIDATION",
				"Your ChatGPT sign-in doesn't allow using your plan here. Sign in again and allow it.",
			);
		}
		const modelId = status.chatgpt.model ?? (await chatGptModels())[0]?.id;
		if (!modelId) throw new DomainError("VALIDATION", "Your ChatGPT plan has no models available.");
		return { model: chatGptModel(modelId), options: CHATGPT_PROVIDER_OPTIONS };
	}

	private async reply(
		request: z.output<typeof requestSchema>,
		send: (event: AssistantStreamEvent) => void,
	) {
		const { requestId, chatId } = request;
		const controller = new AbortController();
		this.running.set(requestId, controller);
		// The workspace this conversation belongs to, even if the user switches mid-reply.
		const repos = this.workspaces.repos;
		try {
			if (!(await this.status()).enabled) {
				throw new DomainError("VALIDATION", "The assistant is turned off for this workspace.");
			}
			const tools = createTools(() => repos);
			const messages = await validateUIMessages<UIMessage>({
				messages: request.messages,
				tools,
				metadataSchema,
			});
			// Saved before the reply, so the question isn't lost if the provider fails.
			repos.assistantChats.save(chatId, { title: titleOf(messages), messages });
			const { model, options } = await this.model();
			const result = streamText({
				model,
				instructions: instructions(repos, request.screen),
				messages: await convertToModelMessages(withContext(repos, messages), {
					tools,
					ignoreIncompleteToolCalls: true,
				}),
				tools,
				toolApproval: Object.fromEntries(WRITE_TOOLS.map((name) => [name, "user-approval"])),
				stopWhen: isStepCount(12),
				abortSignal: controller.signal,
				providerOptions: options,
			});
			const stream = toUIMessageStream({
				stream: result.stream,
				tools,
				originalMessages: messages,
				sendReasoning: false,
				onError: describeError,
				onEnd: ({ messages: final }) => {
					try {
						repos.assistantChats.save(chatId, { title: titleOf(final), messages: final });
					} catch (error) {
						console.error("Couldn't save the conversation", error);
					}
				},
			});
			for await (const chunk of stream) {
				send({ requestId, type: "chunk", chunk });
			}
			send({ requestId, type: "end" });
		} catch (error) {
			if (controller.signal.aborted) send({ requestId, type: "end" });
			else send({ requestId, type: "error", message: describeError(error) });
		} finally {
			this.running.delete(requestId);
		}
	}
}

/** The system prompt: who the assistant is for, what it may do, and what's on screen. */
function instructions(repos: Repositories, screen: AssistantScreen): string {
	const profile = repos.profile.get();
	const lines = [
		`You are the assistant inside Invoicing, a desktop invoicing app. You help ${profile?.name ?? "the user"} create and understand invoices.`,
		`Today is ${todayIso()}. The business's default currency is ${profile?.defaultCurrency ?? "USD"} and payment terms are ${profile?.paymentTermsDays ?? 14} days.`,
		"",
		"How to work:",
		"- Look things up with the tools instead of guessing. Never invent ids, clients, prices or tax rates.",
		"- Before creating a client, search for it. Before adding tax to a line, list the tax rates.",
		"- To create or change data, call the tool directly: the user reviews and approves each change in the app, so don't ask for confirmation in text first.",
		"- You can only create drafts. The user issues, sends, records payments and deletes in the app; point them there.",
		'- Amounts and quantities are decimal strings in the invoice currency ("1250.50", "1.5").',
		"- If something essential is missing (who to bill, what for, or a price), ask one short question.",
		"- Read attached files carefully: timesheets, old invoices, quotes, emails. Turn them into lines or client details.",
		"- Answer in the user's language. Be brief and concrete. Use Markdown lists or tables only when they help.",
	];
	if (screen) {
		const record = describeRecord(repos, screen);
		if (record) {
			lines.push(
				"",
				`The user has this ${screen.type} open right now ("this ${screen.type}" means it):`,
				JSON.stringify(record),
			);
		}
	}
	return lines.join("\n");
}

/**
 * The model's copy of the conversation: attachments read from disk (text files inline as
 * text), and the current data of every @-mentioned record. The saved messages stay as they
 * were, pointing at attachments and mentions by id.
 */
function withContext(repos: Repositories, messages: UIMessage[]): UIMessage[] {
	return messages.map((message) => {
		if (message.role !== "user") return message;
		const parts: UIMessage["parts"] = [];
		for (const part of message.parts) {
			if (part.type !== "file" || !part.url.startsWith("attachment:")) {
				parts.push(part);
				continue;
			}
			const file = readAttachment(part.url.slice("attachment:".length));
			if (!file) {
				parts.push({
					type: "text",
					text: `[Attached file ${part.filename ?? ""} is no longer available]`,
				});
			} else if (isTextType(file.mediaType)) {
				parts.push({
					type: "text",
					text: `Attached file "${part.filename ?? "file"}":\n\`\`\`\n${file.bytes.toString("utf8").slice(0, 200_000)}\n\`\`\``,
				});
			} else {
				parts.push({
					...part,
					mediaType: file.mediaType,
					url: `data:${file.mediaType};base64,${file.bytes.toString("base64")}`,
				});
			}
		}
		const mentions = (message.metadata as { mentions?: Mention[] } | undefined)?.mentions ?? [];
		for (const mention of mentions) {
			const record = describeRecord(repos, mention);
			parts.push({
				type: "text",
				text: record
					? `Mentioned ${mention.type} "${mention.label}": ${JSON.stringify(record)}`
					: `Mentioned ${mention.type} "${mention.label}" no longer exists.`,
			});
		}
		return { ...message, parts };
	});
}

function titleOf(messages: UIMessage[]): string {
	const first = messages.find((message) => message.role === "user");
	const text = first?.parts.find((part) => part.type === "text")?.text.trim() ?? "";
	const line = text.split("\n")[0] ?? "";
	return line.length > 80 ? `${line.slice(0, 77)}…` : line || "New conversation";
}

export type { AssistantRequest };
