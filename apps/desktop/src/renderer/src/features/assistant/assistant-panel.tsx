import { Button } from "@dawnstudio/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { useSidebar } from "@dawnstudio/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dawnstudio/ui/components/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { History, Settings2, ShieldCheck, SquarePen, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { AssistantScreen } from "../../../../shared/api";
import {
	MIN_SCREEN,
	ResizeHandle,
	usePanelWidth,
	useWindowWidth,
} from "../../components/resize-handle";
import {
	type AssistantMessage,
	assistantPanel,
	useAcknowledgeAssistant,
	useAssistantChats,
	useAssistantPanel,
	useAssistantStatus,
	useDeleteAssistantChat,
	useSetAssistantEnabled,
} from "../../lib/assistant";
import { showSaveError } from "../../lib/forms";
import { useWorkspaces } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { Chat } from "./chat";
import { ConnectButtons, MANAGE_USAGE_URL } from "./connect";

export const ASSISTANT_PANEL = { fallback: 400, min: 320, max: 760 };
const PANEL = ASSISTANT_PANEL;

/** The record on screen, so "this invoice" in a message means the open one. */
export function useScreen(): AssistantScreen {
	const { pathname } = useLocation();
	const match = /^\/(invoices|clients)\/([0-9a-f-]{36})$/.exec(pathname);
	if (!match?.[2]) return null;
	return { type: match[1] === "invoices" ? "invoice" : "client", id: match[2] };
}

/** The assistant, docked on the right of every screen. ⌘J opens and closes it. */
export function AssistantPanel({ sidebarWidth }: { sidebarWidth: number }) {
	const { open: wanted } = useAssistantPanel();
	// Home is the assistant itself; no second one on the side.
	const onHome = useLocation().pathname.startsWith("/home");
	const open = wanted && !onHome;
	const { state } = useSidebar();
	// Conversations belong to a workspace: switching starts fresh.
	const { data: workspaces } = useWorkspaces();
	const windowWidth = useWindowWidth();
	const room = windowWidth - (state === "expanded" ? sidebarWidth : 0) - MIN_SCREEN;
	const max = Math.max(PANEL.min, Math.min(PANEL.max, room));
	const { width, setWidth, save } = usePanelWidth("assistant", PANEL.fallback, {
		min: PANEL.min,
		max,
	});
	const [dragging, setDragging] = useState(false);

	return (
		<AnimatePresence initial={false}>
			{open ? (
				<motion.aside
					key="assistant"
					initial={{ width: 0, opacity: 0 }}
					animate={{ width, opacity: 1 }}
					exit={{ width: 0, opacity: 0 }}
					transition={dragging ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
					className="relative shrink-0 overflow-hidden"
					aria-label="Assistant"
				>
					<ResizeHandle
						grows="left"
						label="Resize assistant"
						width={width}
						min={PANEL.min}
						max={max}
						onResize={setWidth}
						onCommit={save}
						onDraggingChange={setDragging}
						onReset={() => {
							setWidth(PANEL.fallback);
							save(PANEL.fallback);
						}}
						className="left-0 justify-start"
					/>
					<div
						style={{ width: width - 6 }}
						className="my-1.5 mr-1.5 flex h-[calc(100%-0.75rem)] flex-col overflow-hidden rounded-[10px] border bg-background shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_16px_-6px_rgb(0_0_0/0.12)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_8px_24px_-8px_rgb(0_0_0/0.6)]"
					>
						<PanelContent key={workspaces?.activeId} />
					</div>
				</motion.aside>
			) : null}
		</AnimatePresence>
	);
}

function PanelContent() {
	const { draft } = useAssistantPanel();
	const { data: status } = useAssistantStatus();
	const { data: chats = [] } = useAssistantChats();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const screen = useScreen();
	const [chat, setChat] = useState<{ id: string; title: string; messages: AssistantMessage[] }>(
		() => ({ id: crypto.randomUUID(), title: "", messages: [] }),
	);
	const deleteChat = useDeleteAssistantChat();
	const acknowledge = useAcknowledgeAssistant();
	const setEnabled = useSetAssistantEnabled();

	const newChat = useCallback(
		() => setChat({ id: crypto.randomUUID(), title: "", messages: [] }),
		[],
	);

	const openChat = async (id: string) => {
		try {
			const saved = await rpc("assistant.chat", { id });
			if (saved) setChat({ ...saved, messages: saved.messages as AssistantMessage[] });
		} catch (error) {
			showSaveError(error);
		}
	};

	const title = chats.find((c) => c.id === chat.id)?.title || chat.title || "Assistant";
	const onReply = useCallback(
		() => void queryClient.invalidateQueries({ queryKey: ["assistant", "chats"] }),
		[queryClient],
	);
	const onDraftUsed = useCallback(() => void assistantPanel.takeDraft(), []);

	let body: React.ReactNode;
	if (!status) {
		body = null;
	} else if (!status.enabled) {
		body = (
			<Centered
				title="The assistant is off in this workspace"
				text="Turn it back on to ask questions and draft invoices here."
			>
				<Button onClick={() => setEnabled.mutate({ enabled: true })}>Turn on</Button>
			</Centered>
		);
	} else if (!status.ready) {
		body = (
			<Centered
				title="Connect a model"
				text="Use your OpenRouter account (any model, pay as you go) or your ChatGPT Plus, Pro or Business plan. Nothing is sent until you connect."
			>
				<ConnectButtons compact />
				<Button variant="link" size="sm" onClick={() => navigate("/settings/assistant")}>
					More in Settings
				</Button>
			</Centered>
		);
	} else {
		body = (
			<Chat
				key={chat.id}
				id={chat.id}
				initialMessages={chat.messages}
				screen={screen}
				disabled={!status.acknowledged}
				draft={status.acknowledged ? draft : null}
				onDraftUsed={onDraftUsed}
				onReply={onReply}
				footer={
					!status.acknowledged ? (
						<Disclosure
							chatgpt={status.provider === "chatgpt"}
							onAccept={() => acknowledge.mutate(undefined)}
						/>
					) : status.provider === "chatgpt" ? (
						<p className="px-1 text-xs text-muted-foreground">
							Using your ChatGPT plan ·{" "}
							<a
								href={MANAGE_USAGE_URL}
								target="_blank"
								rel="noreferrer"
								className="underline-offset-2 hover:underline"
							>
								Manage usage
							</a>
						</p>
					) : null
				}
			/>
		);
	}

	return (
		<>
			<header className="app-drag flex h-11 shrink-0 items-center gap-1 border-b px-2 pl-3">
				<h2 className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">{title}</h2>
				<div className="app-no-drag flex items-center">
					<IconButton label="New conversation" onClick={newChat}>
						<SquarePen />
					</IconButton>
					<DropdownMenu>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label="Conversations"
										className="text-muted-foreground"
									>
										<History />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent>Conversations</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align="end" className="w-72">
							<DropdownMenuLabel>Conversations</DropdownMenuLabel>
							{chats.length === 0 ? (
								<p className="px-2 py-1.5 text-sm text-muted-foreground">None yet.</p>
							) : (
								<div className="max-h-80 overflow-y-auto">
									{chats.map((item) => (
										<DropdownMenuItem
											key={item.id}
											onSelect={() => void openChat(item.id)}
											className="group gap-2"
										>
											<span className="min-w-0 flex-1 truncate">
												{item.title || "New conversation"}
											</span>
											<button
												type="button"
												aria-label={`Delete "${item.title}"`}
												className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
												onClick={(event) => {
													event.preventDefault();
													event.stopPropagation();
													deleteChat.mutate({ id: item.id });
													if (item.id === chat.id) newChat();
												}}
											>
												<Trash2 className="size-3.5" />
											</button>
										</DropdownMenuItem>
									))}
								</div>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={newChat}>
								<SquarePen />
								New conversation
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<IconButton label="Assistant settings" onClick={() => navigate("/settings/assistant")}>
						<Settings2 />
					</IconButton>
					<IconButton label="Close (⌘J)" onClick={assistantPanel.hide}>
						<X />
					</IconButton>
				</div>
			</header>
			{body}
		</>
	);
}

function IconButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={label}
					onClick={onClick}
					className="text-muted-foreground"
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function Centered({
	title,
	text,
	children,
}: {
	title: string;
	text: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
			<div className="flex flex-col gap-1.5">
				<h3 className="font-medium">{title}</h3>
				<p className="text-sm text-pretty text-muted-foreground">{text}</p>
			</div>
			{children}
		</div>
	);
}

/** Shown once before the first message: what leaves this computer, and where it goes. */
export function Disclosure({ chatgpt, onAccept }: { chatgpt: boolean; onAccept: () => void }) {
	return (
		<div className="flex flex-col gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
			<p className="flex items-center gap-2 font-medium">
				<ShieldCheck className="size-4 text-brand-ink" />
				{chatgpt ? "You're using your ChatGPT plan" : "Before your first message"}
			</p>
			<p className="text-muted-foreground">
				Your messages, the files you attach and the records the assistant looks up are sent to{" "}
				{chatgpt ? "OpenAI, on your ChatGPT plan" : "OpenRouter and the model you pick"}. Nothing
				goes through Dawn Studio, and nothing changes in your data until you approve it.
			</p>
			<Button size="sm" className="self-start" onClick={onAccept}>
				Got it
			</Button>
		</div>
	);
}
