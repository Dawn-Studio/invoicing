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
import { Suggestion, Suggestions } from "@dawnstudio/ui/components/ai-elements/suggestion";
import { Button } from "@dawnstudio/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { CircleAlert, FileText, Package, Paperclip, RotateCw, Sparkles, User } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import type { AssistantScreen } from "../../../../shared/api";
import type { Mention } from "../../../../shared/contract";
import { type AssistantMessage, IpcChatTransport } from "../../lib/assistant";
import { useRpcQuery } from "../../lib/queries";
import { type ComposedMessage, Composer } from "./composer";
import { ToolPart } from "./tool-part";

const SUGGESTIONS = [
	"Draft an invoice for my last client, same lines as last time",
	"Who owes me money right now?",
	"Turn the attached timesheet into an invoice",
	"How much did I invoice this year, per client?",
];

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

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Conversation className="min-h-0 flex-1">
				<ConversationContent className="gap-5 px-4 py-4">
					{messages.length === 0 ? (
						<ConversationEmptyState className="px-2">
							<div className="flex flex-col items-center gap-3">
								<Sparkles className="size-6 text-brand-ink" />
								<div className="flex flex-col gap-1">
									<h3 className="font-medium">What can I help with?</h3>
									<p className="text-sm text-muted-foreground">
										Draft invoices from a description, a timesheet or an old PDF. Ask about clients
										and payments. You approve every change.
									</p>
								</div>
								<Suggestions className="mt-2 flex-col items-stretch gap-1.5 whitespace-normal">
									{SUGGESTIONS.map((suggestion) => (
										<Suggestion
											key={suggestion}
											suggestion={suggestion}
											disabled={disabled}
											onClick={(text) => void send({ text, files: [], mentions: [] })}
											className="h-auto justify-start rounded-md px-3 py-2 text-left whitespace-normal"
										/>
									))}
								</Suggestions>
							</div>
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
			<div className="flex flex-col gap-2 px-3 pt-1 pb-3">
				<Composer
					status={status}
					disabled={disabled}
					draft={draft}
					onDraftUsed={onDraftUsed}
					onStop={() => void stop()}
					onSend={(message) => send(message)}
				/>
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
