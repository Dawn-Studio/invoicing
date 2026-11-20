import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { useSyncExternalStore } from "react";
import type { AssistantScreen } from "../../../shared/api";
import type { AssistantProvider, Mention } from "../../../shared/contract";
import { useRpcMutation, useRpcQuery } from "./queries";

/** What user messages carry besides text: the records they @-mentioned. */
export interface AssistantMetadata {
	mentions?: Mention[];
}
export type AssistantMessage = UIMessage<AssistantMetadata>;

/**
 * Streams replies from the main process, where the model, tools and provider credentials
 * live. Each send starts one reply; aborting tells main to stop it.
 */
export class IpcChatTransport implements ChatTransport<AssistantMessage> {
	constructor(private readonly screen: () => AssistantScreen) {}

	async sendMessages({
		chatId,
		messages,
		abortSignal,
	}: Parameters<ChatTransport<AssistantMessage>["sendMessages"]>[0]) {
		const requestId = crypto.randomUUID();
		const screen = this.screen();
		return new ReadableStream<UIMessageChunk>({
			start(controller) {
				let closed = false;
				const finish = (error?: Error) => {
					if (closed) return;
					closed = true;
					if (error) controller.error(error);
					else controller.close();
				};
				const stop = window.api.assistant({ requestId, chatId, messages, screen }, (event) => {
					if (event.type === "chunk") controller.enqueue(event.chunk as UIMessageChunk);
					else if (event.type === "end") finish();
					else finish(new Error(event.message));
				});
				abortSignal?.addEventListener("abort", () => {
					stop();
					finish();
				});
			},
		});
	}

	async reconnectToStream() {
		return null;
	}
}

/* The panel: open or closed, and a prompt waiting to be sent (from ⌘K or a suggestion). */
type PanelState = { open: boolean; draft: string | null };
let state: PanelState = { open: false, draft: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<PanelState>) => {
	state = { ...state, ...next };
	for (const listener of listeners) listener();
};

export const assistantPanel = {
	toggle: () => emit({ open: !state.open }),
	show: (draft?: string) => emit({ open: true, draft: draft ?? state.draft }),
	hide: () => emit({ open: false }),
	/** Puts a prompt in whichever box is showing (Home's or the panel's) without opening anything. */
	prefill: (draft: string) => emit({ draft }),
	takeDraft: () => {
		const { draft } = state;
		if (draft !== null) state = { ...state, draft: null };
		return draft;
	},
};

export function useAssistantPanel() {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => state,
	);
}

export const useAssistantStatus = () => useRpcQuery("assistant.status");
export const useAssistantModels = (provider: AssistantProvider, enabled = true) =>
	useRpcQuery("assistant.models", { provider }, { enabled, staleTime: 60 * 60_000 });
export const useAssistantChats = () => useRpcQuery("assistant.chats");
export const useSetAssistantModel = () => useRpcMutation("assistant.setModel", ["assistant"]);
export const useSetAssistantProvider = () => useRpcMutation("assistant.setProvider", ["assistant"]);
export const useSetAssistantEnabled = () => useRpcMutation("assistant.setEnabled", ["assistant"]);
export const useSetAutoApprove = () => useRpcMutation("assistant.setAutoApprove", ["assistant"]);
export const useAcknowledgeAssistant = () => useRpcMutation("assistant.acknowledge", ["assistant"]);
export const useDisconnectAssistant = () => useRpcMutation("assistant.disconnect", ["assistant"]);
export const useDeleteAssistantChat = () => useRpcMutation("assistant.deleteChat", ["assistant"]);

/** USD per million tokens, short. */
export function formatPrice(price: { input: number; output: number } | null) {
	if (!price) return null;
	const fmt = (value: number) =>
		value === 0 ? "free" : `$${value < 1 ? value.toFixed(2) : value.toFixed(value < 10 ? 1 : 0)}`;
	return price.input === 0 && price.output === 0
		? "Free"
		: `${fmt(price.input)} / ${fmt(price.output)}`;
}
