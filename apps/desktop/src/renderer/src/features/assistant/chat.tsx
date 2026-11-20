import { useChat } from "@ai-sdk/react";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "@dawnstudio/ui/components/ai-elements/conversation";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@dawnstudio/ui/components/ai-elements/message";
import { Shimmer } from "@dawnstudio/ui/components/ai-elements/shimmer";
import { Button } from "@dawnstudio/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { CircleAlert, FileText, Package, Paperclip, RotateCw, User } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import type { AssistantScreen } from "../../../../shared/api";
import type { Mention } from "../../../../shared/contract";
import { type AssistantMessage, IpcChatTransport } from "../../lib/assistant";
import { useRpcQuery } from "../../lib/queries";
import { type ComposedMessage, Composer } from "./composer";
import { ToolPart } from "./tool-part";
import { AssistantWelcome, SuggestionChips, WELCOME_SUGGESTIONS } from "./welcome";

interface ChatProps {
	id: string;
	initialMessages: AssistantMessage[];
	screen: AssistantScreen;
	disabled: boolean;
	/** A prompt to put in the box (from ⌘K or elsewhere). */
	draft: string | null;
	onDraftUsed: () => void;
	/** After each reply, so the conversation list shows it. */
	onReply: () => void;
	footer?: React.ReactNode;
	/** "page" fills a screen: a centred prompt while empty, then a reading-width column. */
	layout?: "panel" | "page";
	/** Page layout, empty conversation: shown above the prompt (greeting, summary). */
	hero?: React.ReactNode;
	/** Prompts offered before the first message. */
	suggestions?: string[];
}

/** One conversation: messages, tool calls with approvals, and the composer. */
export function Chat({
	id,
	initialMessages,
	screen,
	disabled,
	draft,
	onDraftUsed,
	onReply,
	footer,
	layout = "panel",
	hero,
	suggestions = WELCOME_SUGGESTIONS,
}: ChatProps) {
	const queryClient = useQueryClient();
	const screenRef = useRef(screen);
	screenRef.current = screen;
	const transport = useMemo(() => new IpcChatTransport(() => screenRef.current), []);

	const {
		messages,
		sendMessage,
		status,
		stop,
		error,
		regenerate,
		addToolApprovalResponse,
		clearError,
	} = useChat<AssistantMessage>({
		id,
		messages: initialMessages,
		transport,
		// After the user approves or declines a change, carry on with the reply.
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
		onFinish: () => {
			// Tools may have added clients or drafts; show them everywhere.
			void queryClient.invalidateQueries();
			onReply();
		},
	});

	const send = useCallback(
		async ({ text, files, mentions }: ComposedMessage) => {
			clearError();
			await sendMessage({
				text: text || "Here's a file.",
				files,
				metadata: mentions.length ? { mentions } : undefined,
			});
		},
		[sendMessage, clearError],
	);

	const last = messages.at(-1);
	const thinking =
		status === "submitted" ||
		(status === "streaming" && last?.role === "assistant" && last.parts.length === 0);

	const composer = (
		<Composer
			status={status}
			disabled={disabled}
			draft={draft}
			onDraftUsed={onDraftUsed}
			onStop={() => void stop()}
			onSend={(message) => send(message)}
			className={
				layout === "page"
					? "composer-glow rounded-2xl bg-background/80 shadow-lg backdrop-blur-xl"
					: undefined
			}
			textareaClassName={
				layout === "page" && messages.length === 0 ? "min-h-28 text-base md:text-base" : undefined
			}
		/>
	);

	// A full screen with nothing said yet: the prompt in the middle, suggestions under it.
	if (layout === "page" && messages.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
				<div className="m-auto flex w-full max-w-[46rem] flex-col gap-6 px-6 py-10">
					{hero ?? <AssistantWelcome />}
					{composer}
					<SuggestionChips
						suggestions={suggestions}
						disabled={disabled}
						onPick={(text) => void send({ text, files: [], mentions: [] })}
					/>
					{footer}
				</div>
			</div>
		);
	}

	const column = layout === "page" ? "mx-auto w-full max-w-3xl px-6" : "px-4";
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Conversation className="min-h-0 flex-1">
				<ConversationContent className={`gap-5 py-4 ${column} ${layout === "page" ? "pt-8" : ""}`}>
					{messages.length === 0 ? (
						<ConversationEmptyState className="gap-5 px-2">
							{hero ?? <AssistantWelcome size="panel" />}
							<SuggestionChips
								suggestions={suggestions}
								disabled={disabled}
								onPick={(text) => void send({ text, files: [], mentions: [] })}
							/>
						</ConversationEmptyState>
					) : null}
					{messages.map((message) => (
						<Message key={message.id} from={message.role} className="max-w-full">
							<MessageContent className="min-w-0 select-text group-[.is-assistant]:w-full group-[.is-user]:max-w-[90%]">
								{message.parts.map((part, index) => {
									const key = `${message.id}-${index}`;
									if (part.type === "text") {
										return message.role === "assistant" ? (
											<MessageResponse key={key}>{part.text}</MessageResponse>
										) : (
											<p key={key} className="whitespace-pre-wrap">
												{part.text}
											</p>
										);
									}
									if (part.type === "file") return <AttachmentChip key={key} part={part} />;
									if (isToolUIPart(part) && part.type !== "dynamic-tool") {
										return <ToolPart key={key} part={part} onApproval={addToolApprovalResponse} />;
									}
									return null;
								})}
								{message.metadata?.mentions?.length ? (
									<div className="flex flex-wrap gap-1">
										{message.metadata.mentions.map((mention) => (
											<MentionTag key={`${mention.type}-${mention.id}`} mention={mention} />
										))}
									</div>
								) : null}
							</MessageContent>
						</Message>
					))}
					{thinking ? <Shimmer className="text-sm">Thinking…</Shimmer> : null}
					{error ? (
						<div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
							<CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
							<p className="flex-1">{error.message}</p>
							<Button size="sm" variant="outline" onClick={() => void regenerate()}>
								<RotateCw />
								Retry
							</Button>
						</div>
					) : null}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
			<div
				className={`flex flex-col gap-2 pt-1 ${layout === "page" ? "mx-auto w-full max-w-3xl px-6 pb-6" : "px-3 pb-3"}`}
			>
				{composer}
				{footer}
			</div>
		</div>
	);
}

function AttachmentChip({ part }: { part: { url: string; mediaType: string; filename?: string } }) {
	const id = part.url.startsWith("attachment:") ? part.url.slice("attachment:".length) : null;
	const image = part.mediaType.startsWith("image/");
	const { data: src } = useRpcQuery(
		"assistant.attachment",
		{ id: id ?? "" },
		{ enabled: Boolean(id) && image, staleTime: Infinity },
	);
	if (image && src) {
		return (
			<img
				src={src}
				alt={part.filename ?? "Attached image"}
				className="max-h-48 max-w-full self-end rounded-md border object-contain"
			/>
		);
	}
	return (
		<span className="inline-flex max-w-full items-center gap-1.5 self-end rounded-md border bg-background px-2 py-1 text-xs">
			<Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
			<span className="truncate">{part.filename ?? "File"}</span>
		</span>
	);
}

const MENTION_ICONS = { client: User, invoice: FileText, item: Package } as const;

function MentionTag({ mention }: { mention: Mention }) {
	const Icon = MENTION_ICONS[mention.type];
	return (
		<span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground">
			<Icon className="size-3" />
			{mention.label}
		</span>
	);
}
