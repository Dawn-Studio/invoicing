import { Badge } from "@dawnstudio/ui/components/badge";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { Input } from "@dawnstudio/ui/components/input";
import { Label } from "@dawnstudio/ui/components/label";
import {
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	PanelLabel,
	PanelTitle,
	RowList,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { Switch } from "@dawnstudio/ui/components/switch";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AssistantProvider, AssistantStatus } from "../../../../shared/contract";
import {
	formatPrice,
	useAssistantModels,
	useAssistantStatus,
	useDisconnectAssistant,
	useSetAssistantEnabled,
	useSetAssistantProvider,
} from "../../lib/assistant";
import { showSaveError } from "../../lib/forms";
import { useRpcQuery } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { MANAGE_USAGE_URL, useConnect } from "../assistant/connect";

/** Settings → Assistant: which provider and model, this workspace's switch, conversations. */
export function AssistantSettings() {
	const { data: status } = useAssistantStatus();
	if (!status) return null;
	return (
		<>
			<ProvidersPanel status={status} />
			<WorkspacePanel status={status} />
		</>
	);
}

function ProvidersPanel({ status }: { status: AssistantStatus }) {
	const { pending, connect, cancel } = useConnect();
	const disconnect = useDisconnectAssistant();
	const setProvider = useSetAssistantProvider();
	const [pasting, setPasting] = useState(false);
	const both = status.openrouter.connected && status.chatgpt.connected;

	const row = (
		provider: AssistantProvider,
		title: string,
		description: React.ReactNode,
		connected: boolean,
		actions: React.ReactNode,
	) => (
		<li className="flex flex-col gap-1.5">
			<div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
				<span className="font-medium">{title}</span>
				{provider === "openrouter" ? <Badge variant="secondary">Default</Badge> : null}
				{connected && status.provider === provider ? (
					<span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-success">
						<CircleCheck className="size-3.5" />
						In use
					</span>
				) : null}
				<div className="ml-auto flex shrink-0 items-center gap-2">
					{pending === provider ? (
						<>
							<span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
								<Spinner /> In your browser…
							</span>
							<Button size="sm" variant="ghost" onClick={cancel}>
								Cancel
							</Button>
						</>
					) : (
						<>
							{both && status.provider !== provider ? (
								<Button
									size="sm"
									variant="outline"
									onClick={() => setProvider.mutate({ provider })}
								>
									Use
								</Button>
							) : null}
							{actions}
						</>
					)}
				</div>
			</div>
			<div className="text-sm text-muted-foreground">{description}</div>
		</li>
	);

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Model provider</PanelTitle>
				<PanelLabel>{status.ready ? "Connected" : "Not connected"}</PanelLabel>
			</PanelHeader>
			<PanelBody className="py-1">
				<RowList>
					{row(
						"openrouter",
						"OpenRouter",
						status.openrouter.connected ? (
							<OpenRouterDetails status={status} />
						) : (
							"Hundreds of models (Claude, GPT, Gemini and more) on your own OpenRouter account. Pay as you go."
						),
						status.openrouter.connected,
						status.openrouter.connected ? (
							<Button
								size="sm"
								variant="ghost"
								onClick={() => disconnect.mutate({ provider: "openrouter" })}
							>
								Disconnect
							</Button>
						) : (
							<>
								<Button size="sm" variant="ghost" onClick={() => setPasting(true)}>
									<KeyRound />
									Paste a key
								</Button>
								<Button
									size="sm"
									disabled={pending !== null}
									onClick={() => void connect("openrouter")}
								>
									Connect
								</Button>
							</>
						),
					)}
					{row(
						"chatgpt",
						"ChatGPT",
						status.chatgpt.connected ? (
							<span className="flex flex-col gap-0.5">
								<span>
									Signed in{status.chatgpt.email ? ` as ${status.chatgpt.email}` : ""}.{" "}
									{status.chatgpt.planUsage
										? "Requests use your ChatGPT plan."
										: "Using your plan wasn't allowed; sign in again to allow it."}
								</span>
								<a
									href={MANAGE_USAGE_URL}
									target="_blank"
									rel="noreferrer"
									className="text-foreground underline-offset-2 hover:underline"
								>
									Manage usage
								</a>
							</span>
						) : (
							"Use your ChatGPT Plus, Pro or Business plan, within the limit you set for this app."
						),
						status.chatgpt.connected,
						status.chatgpt.connected ? (
							<>
								{!status.chatgpt.planUsage ? (
									<Button size="sm" variant="outline" onClick={() => void connect("chatgpt")}>
										Sign in again
									</Button>
								) : null}
								<Button
									size="sm"
									variant="ghost"
									onClick={() => disconnect.mutate({ provider: "chatgpt" })}
								>
									Sign out
								</Button>
							</>
						) : (
							<Button
								size="sm"
								variant="outline"
								disabled={pending !== null}
								onClick={() => void connect("chatgpt")}
							>
								Sign in with ChatGPT
							</Button>
						),
					)}
				</RowList>
			</PanelBody>
			{status.ready ? <ModelRow status={status} /> : null}
			<PanelFooter>
				Keys and sign-ins are stored in your system keychain on this computer, never in workspace
				files or backups. Your messages, attachments and the records the assistant looks up go
				straight to the provider; nothing goes through Dawn Studio.
			</PanelFooter>
			<PasteKeyDialog open={pasting} onOpenChange={setPasting} />
		</Panel>
	);
}

function OpenRouterDetails({ status }: { status: AssistantStatus }) {
	const { data: usage } = useRpcQuery("assistant.openRouterUsage", undefined, {
		staleTime: 60_000,
	});
	const usd = (value: number) => `$${value.toFixed(2)}`;
	return (
		<span>
			{status.openrouter.via === "oauth" ? "Connected to your account" : "Using a pasted key"}
			{usage
				? ` · ${usd(usage.usage)} spent${usage.remaining !== null ? `, ${usd(usage.remaining)} left` : ""}`
				: ""}
			.
		</span>
	);
}

function ModelRow({ status }: { status: AssistantStatus }) {
	const { data: models = [] } = useAssistantModels(status.provider);
	const model = models.find((m) => m.id === status.model);
	return (
		<PanelBody className="flex flex-col gap-0.5 border-t">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-[0.9375rem]">Model</span>
				<span className="truncate text-sm text-muted-foreground">
					{model
						? `${model.name}${formatPrice(model.price) ? ` · ${formatPrice(model.price)} per million tokens` : ""}`
						: (status.model ?? "The plan's default")}
				</span>
			</div>
			<span className="text-xs text-muted-foreground">
				Switch models from the menu under the assistant's message box.
			</span>
		</PanelBody>
	);
}

function WorkspacePanel({ status }: { status: AssistantStatus }) {
	const setEnabled = useSetAssistantEnabled();
	const queryClient = useQueryClient();
	const [deleting, setDeleting] = useState(false);

	const deleteAll = async () => {
		setDeleting(true);
		try {
			await rpc("assistant.deleteChats");
			await queryClient.invalidateQueries({ queryKey: ["assistant"] });
			toast.success("Conversations deleted");
		} catch (error) {
			showSaveError(error);
		} finally {
			setDeleting(false);
		}
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>This workspace</PanelTitle>
			</PanelHeader>
			<PanelBody className="flex items-center gap-4">
				<Label
					htmlFor="assistant-enabled"
					className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
				>
					<span className="text-[0.9375rem]">Use the assistant here</span>
					<span className="text-sm text-muted-foreground">
						Off keeps this workspace's data away from any AI provider.
					</span>
				</Label>
				<Switch
					id="assistant-enabled"
					checked={status.enabled}
					onCheckedChange={(enabled) => setEnabled.mutate({ enabled })}
				/>
			</PanelBody>
			<PanelBody className="flex items-center gap-4 border-t">
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="text-[0.9375rem]">Conversations</span>
					<span className="text-sm text-muted-foreground">
						Saved in this workspace and included in its backups.
					</span>
				</div>
				<Button size="sm" variant="outline" disabled={deleting} onClick={() => void deleteAll()}>
					Delete all
				</Button>
			</PanelBody>
		</Panel>
	);
}

function PasteKeyDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [key, setKey] = useState("");
	const [saving, setSaving] = useState(false);

	const save = async (event: React.FormEvent) => {
		event.preventDefault();
		setSaving(true);
		try {
			await rpc("assistant.setOpenRouterKey", { key });
			await queryClient.invalidateQueries({ queryKey: ["assistant"] });
			toast.success("OpenRouter connected");
			setKey("");
			onOpenChange(false);
		} catch (error) {
			showSaveError(error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>Paste an OpenRouter key</DialogTitle>
						<DialogDescription>
							Create one at openrouter.ai/keys. It's checked with OpenRouter and kept in your system
							keychain.
						</DialogDescription>
					</DialogHeader>
					<Input
						autoFocus
						type="password"
						placeholder="sk-or-…"
						value={key}
						onChange={(event) => setKey(event.target.value)}
						className="font-mono"
					/>
					<DialogFooter>
						<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving || key.trim().length < 10}>
							{saving ? <Spinner /> : null}
							Connect
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
