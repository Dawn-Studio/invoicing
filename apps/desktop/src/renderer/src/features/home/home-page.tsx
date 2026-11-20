import { Button } from "@dawnstudio/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@dawnstudio/ui/components/sidebar";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { History, LayoutDashboard, SquarePen, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import {
	type AssistantMessage,
	assistantPanel,
	useAcknowledgeAssistant,
	useAssistantChats,
	useAssistantPanel,
	useAssistantStatus,
	useSetAssistantEnabled,
} from "../../lib/assistant";
import { showSaveError } from "../../lib/forms";
import { useWorkspaces } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { Disclosure, useScreen } from "../assistant/assistant-panel";
import { Chat } from "../assistant/chat";
import { ConnectButtons, MANAGE_USAGE_URL } from "../assistant/connect";
import { AssistantWelcome } from "../assistant/welcome";
import { useStartInvoice } from "../invoices/use-start-invoice";

/**
 * Home: the assistant in the middle of the screen, over a slow aurora in the palette's
 * colours. Ask, attach, mention; the conversation then continues here full width.
 */
export function HomePage() {
	const { data: workspaces } = useWorkspaces();
	// A workspace's conversations are its own: switching starts fresh.
	return <Home key={workspaces?.activeId} />;
}

function Home() {
	const { data: status } = useAssistantStatus();
	const { data: chats = [] } = useAssistantChats();
	const { draft } = useAssistantPanel();
	const screen = useScreen();
	const queryClient = useQueryClient();
	const acknowledge = useAcknowledgeAssistant();
	const setEnabled = useSetAssistantEnabled();
	const [chat, setChat] = useState<{ id: string; messages: AssistantMessage[] }>(() => ({
		id: crypto.randomUUID(),
		messages: [],
	}));
	const [started, setStarted] = useState(false);

	const newChat = useCallback(() => {
		setChat({ id: crypto.randomUUID(), messages: [] });
		setStarted(false);
	}, []);
	const openChat = async (id: string) => {
		try {
			const saved = await rpc("assistant.chat", { id });
			if (saved) {
				setChat({ id: saved.id, messages: saved.messages as AssistantMessage[] });
				setStarted(true);
			}
		} catch (error) {
			showSaveError(error);
		}
	};
	const onReply = useCallback(() => {
		setStarted(true);
		void queryClient.invalidateQueries({ queryKey: ["assistant", "chats"] });
	}, [queryClient]);
	const onDraftUsed = useCallback(() => void assistantPanel.takeDraft(), []);
	const active = started || chat.messages.length > 0;

	let body: React.ReactNode = null;
	if (status && !status.enabled) {
		body = (
			<Centered>
				<AssistantWelcome subtitle="The assistant is off in this workspace." />
				<Button className="self-center" onClick={() => setEnabled.mutate({ enabled: true })}>
					Turn it on
				</Button>
			</Centered>
		);
	} else if (status && !status.ready) {
		body = (
			<Centered>
				<AssistantWelcome subtitle="Connect a model to draft invoices, ask about clients and payments, or turn a timesheet into lines." />
				<div className="flex flex-col items-center gap-4 rounded-2xl border bg-background/70 p-6 shadow-lg backdrop-blur-xl">
					<ConnectButtons />
					<p className="max-w-sm text-center text-xs text-muted-foreground">
						Your OpenRouter account or your ChatGPT Plus, Pro or Business plan. Nothing is sent
						until you connect.
					</p>
				</div>
				<QuickLinks />
			</Centered>
		);
	} else if (status) {
		body = (
			<Chat
				key={chat.id}
				id={chat.id}
				layout="page"
				initialMessages={chat.messages}
				screen={screen}
				disabled={!status.acknowledged}
				draft={status.acknowledged ? draft : null}
				onDraftUsed={onDraftUsed}
				onReply={onReply}
				hero={<AssistantWelcome />}
				footer={
					!status.acknowledged ? (
						<Disclosure
							chatgpt={status.provider === "chatgpt"}
							onAccept={() => acknowledge.mutate(undefined)}
						/>
					) : status.provider === "chatgpt" ? (
						<p className="text-center text-xs text-muted-foreground">
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
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden">
			<Backdrop quiet={active} />
			<HomeHeader
				chats={chats}
				currentId={chat.id}
				onNew={newChat}
				onOpen={(id) => void openChat(id)}
				showActions={Boolean(status?.ready && status.enabled)}
			/>
			<main className="relative flex min-h-0 flex-1 flex-col">{body}</main>
		</div>
	);
}

/** The aurora, a dot grid and a little grain. Dims once a conversation is under way. */
function Backdrop({ quiet }: { quiet: boolean }) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 transition-opacity duration-1000",
				quiet ? "opacity-40" : "opacity-100",
			)}
		>
			<div className="absolute inset-x-0 top-[-10%] h-[80%] opacity-55 dark:opacity-40">
				<span className="aurora-blob top-[8%] left-[18%] size-[46%] bg-primary" />
				<span className="aurora-blob top-[22%] right-[12%] size-[38%] bg-[color-mix(in_oklab,var(--primary)_55%,#38bdf8)]" />
				<span className="aurora-blob top-[40%] left-[38%] size-[30%] bg-[color-mix(in_oklab,var(--primary)_45%,#f472b6)] opacity-70" />
			</div>
			<div className="home-dots absolute inset-0" />
			<div className="home-grain absolute inset-0" />
			{/* Keep the bottom calm, where the conversation and the prompt sit. */}
			<div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/70 to-transparent" />
		</div>
	);
}

function HomeHeader({
	chats,
	currentId,
	onNew,
	onOpen,
	showActions,
}: {
	chats: { id: string; title: string }[];
	currentId: string;
	onNew: () => void;
	onOpen: (id: string) => void;
	showActions: boolean;
}) {
	const { state } = useSidebar();
	return (
		<header
			className={cn(
				"app-drag relative z-10 flex h-11 shrink-0 items-center gap-2 px-3",
				state === "collapsed" && "in-data-[platform=darwin]:pl-22",
			)}
		>
			<SidebarTrigger className="app-no-drag size-7 text-muted-foreground" />
			{showActions ? (
				<div className="app-no-drag ml-auto flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
								<History />
								History
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-72">
							<DropdownMenuLabel>Conversations</DropdownMenuLabel>
							{chats.length === 0 ? (
								<p className="px-2 py-1.5 text-sm text-muted-foreground">None yet.</p>
							) : (
								<div className="max-h-80 overflow-y-auto">
									{chats.map((item) => (
										<DropdownMenuItem
											key={item.id}
											onSelect={() => onOpen(item.id)}
											className={cn(item.id === currentId && "bg-accent")}
										>
											<span className="truncate">{item.title || "New conversation"}</span>
										</DropdownMenuItem>
									))}
								</div>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={onNew}>
								<SquarePen />
								New conversation
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						variant="ghost"
						size="sm"
						className="gap-1.5 text-muted-foreground"
						onClick={onNew}
					>
						<SquarePen />
						New
					</Button>
				</div>
			) : null}
		</header>
	);
}

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<div className="m-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">{children}</div>
		</div>
	);
}

function QuickLinks() {
	const navigate = useNavigate();
	const start = useStartInvoice();
	const links = [
		{ label: "New invoice", icon: SquarePen, run: () => void start.run() },
		{ label: "Clients", icon: Users, run: () => navigate("/clients") },
		{ label: "Dashboard", icon: LayoutDashboard, run: () => navigate("/dashboard") },
	];
	return (
		<div className="flex flex-wrap justify-center gap-2">
			{links.map(({ label, icon: Icon, run }) => (
				<Button
					key={label}
					variant="ghost"
					size="sm"
					className="text-muted-foreground"
					onClick={run}
				>
					<Icon />
					{label}
				</Button>
			))}
		</div>
	);
}
