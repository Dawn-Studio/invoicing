import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorTrigger,
} from "@dawnstudio/ui/components/ai-elements/model-selector";
import {
	PromptInput,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInputBody,
	PromptInputButton,
	PromptInputFooter,
	PromptInputHeader,
	type PromptInputMessage,
	PromptInputProvider,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputAttachments,
	usePromptInputController,
} from "@dawnstudio/ui/components/ai-elements/prompt-input";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@dawnstudio/ui/components/command";
import { Popover, PopoverAnchor, PopoverContent } from "@dawnstudio/ui/components/popover";
import type { ChatStatus, FileUIPart } from "ai";
import { AtSign, Check, ChevronsUpDown, FileText, Package, Paperclip, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AssistantProvider, Mention } from "../../../../shared/contract";
import {
	formatPrice,
	useAssistantModels,
	useAssistantStatus,
	useSetAssistantModel,
} from "../../lib/assistant";
import { useRpcQuery } from "../../lib/queries";
import { rpc } from "../../lib/rpc";

/** What the composer hands the chat: text, stored attachments and mentioned records. */
export interface ComposedMessage {
	text: string;
	files: FileUIPart[];
	mentions: Mention[];
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,.csv,.tsv,.txt,.md,.json";
const MENTION_ICONS = { client: User, invoice: FileText, item: Package } as const;

interface ComposerProps {
	status: ChatStatus;
	disabled?: boolean;
	onSend: (message: ComposedMessage) => Promise<void> | void;
	onStop: () => void;
	/** Text to put in the box (e.g. a suggestion), consumed once. */
	draft: string | null;
	onDraftUsed: () => void;
}

/** Stores a picked file in main and points the message at it instead of carrying its bytes. */
async function store(file: FileUIPart): Promise<FileUIPart> {
	const data = file.url.slice(file.url.indexOf(",") + 1);
	const saved = await rpc("assistant.saveAttachment", {
		filename: file.filename ?? "file",
		mediaType: file.mediaType,
		data,
	});
	return { type: "file", url: saved.url, mediaType: saved.mediaType, filename: saved.filename };
}

export function Composer(props: ComposerProps) {
	const [mentions, setMentions] = useState<Mention[]>([]);
	const [picking, setPicking] = useState(false);
	const busy = props.status === "submitted" || props.status === "streaming";

	const submit = async ({ text, files }: PromptInputMessage) => {
		if (busy || props.disabled) throw new Error("busy");
		if (!text.trim() && files.length === 0) throw new Error("empty");
		let stored: FileUIPart[];
		try {
			stored = await Promise.all(files.map(store));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Couldn't attach that file");
			throw error;
		}
		await props.onSend({ text: text.trim(), files: stored, mentions });
		setMentions([]);
	};

	return (
		<PromptInputProvider>
			<MentionPicker
				open={picking}
				onOpenChange={setPicking}
				onPick={(mention) =>
					setMentions((list) =>
						list.some((m) => m.type === mention.type && m.id === mention.id)
							? list
							: [...list, mention],
					)
				}
			>
				<PromptInput
					accept={ACCEPT}
					multiple
					maxFiles={10}
					maxFileSize={20 * 1024 * 1024}
					onError={(error) => toast.error(error.message)}
					onSubmit={submit}
					className="rounded-xl bg-background shadow-xs"
				>
					<PromptInputHeader className="p-0">
						<PromptInputAttachments className="px-2.5 pt-2.5 pb-0">
							{(file) => <PromptInputAttachment data={file} />}
						</PromptInputAttachments>
						{mentions.length > 0 ? (
							<div className="flex w-full flex-wrap gap-1.5 px-2.5 pt-2.5">
								{mentions.map((mention) => (
									<MentionChip
										key={`${mention.type}-${mention.id}`}
										mention={mention}
										onRemove={() => setMentions((list) => list.filter((m) => m !== mention))}
									/>
								))}
							</div>
						) : null}
					</PromptInputHeader>
					<PromptInputBody>
						<Textarea
							disabled={props.disabled}
							draft={props.draft}
							onDraftUsed={props.onDraftUsed}
							onMention={() => setPicking(true)}
						/>
					</PromptInputBody>
					<PromptInputFooter className="px-1.5 pb-1.5">
						<PromptInputTools className="min-w-0">
							<AttachButton />
							<PromptInputButton
								aria-label="Mention a client, invoice or item"
								title="Mention a client, invoice or item (@)"
								onClick={() => setPicking(true)}
							>
								<AtSign />
							</PromptInputButton>
							<ModelPicker />
						</PromptInputTools>
						{busy ? (
							<PromptInputSubmit
								status={props.status}
								type="button"
								aria-label="Stop"
								onClick={props.onStop}
							/>
						) : (
							<PromptInputSubmit status={props.status} disabled={props.disabled} />
						)}
					</PromptInputFooter>
				</PromptInput>
			</MentionPicker>
		</PromptInputProvider>
	);
}

function Textarea({
	disabled,
	draft,
	onDraftUsed,
	onMention,
}: {
	disabled?: boolean;
	draft: string | null;
	onDraftUsed: () => void;
	onMention: () => void;
}) {
	const { textInput } = usePromptInputController();
	const ref = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (draft === null) return;
		textInput.setInput(draft);
		onDraftUsed();
		ref.current?.focus();
	}, [draft, onDraftUsed, textInput]);

	return (
		<PromptInputTextarea
			ref={ref}
			autoFocus
			disabled={disabled}
			placeholder="Describe an invoice, ask about clients, or drop a timesheet… (@ to mention)"
			className="max-h-60 min-h-12 text-[0.9375rem] select-text"
			onKeyDown={(event) => {
				// "@" at the start of a word opens the picker instead of typing it.
				if (event.key !== "@") return;
				const { selectionStart, value } = event.currentTarget;
				if (selectionStart === 0 || /\s/.test(value[selectionStart - 1] ?? "")) {
					event.preventDefault();
					onMention();
				}
			}}
		/>
	);
}

function AttachButton() {
	const attachments = usePromptInputAttachments();
	return (
		<PromptInputButton
			aria-label="Attach files"
			title="Attach images, PDFs or text files"
			onClick={() => attachments.openFileDialog()}
		>
			<Paperclip />
		</PromptInputButton>
	);
}

function MentionChip({ mention, onRemove }: { mention: Mention; onRemove: () => void }) {
	const Icon = MENTION_ICONS[mention.type];
	return (
		<span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border bg-muted/50 pr-1 pl-2 text-xs">
			<Icon className="size-3.5 shrink-0 text-muted-foreground" />
			<span className="truncate">{mention.label}</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${mention.label}`}
				className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
			>
				<X className="size-3" />
			</button>
		</span>
	);
}

/** "@": search clients, invoices and saved items to attach as context. */
function MentionPicker({
	open,
	onOpenChange,
	onPick,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (mention: Mention) => void;
	children: React.ReactNode;
}) {
	const [search, setSearch] = useState("");
	const { data: results = [] } = useRpcQuery(
		"assistant.mentions",
		{ search },
		{ enabled: open, staleTime: 5_000 },
	);
	const groups = [
		{ type: "client", heading: "Clients" },
		{ type: "invoice", heading: "Invoices" },
		{ type: "item", heading: "Items" },
	] as const;

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setSearch("");
			}}
		>
			<PopoverAnchor asChild>
				<div>{children}</div>
			</PopoverAnchor>
			<PopoverContent align="start" side="top" className="w-80 p-0">
				<Command shouldFilter={false}>
					<CommandInput
						autoFocus
						placeholder="Mention a client, invoice or item…"
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList className="max-h-72">
						<CommandEmpty>Nothing found.</CommandEmpty>
						{groups.map(({ type, heading }) => {
							const items = results.filter((result) => result.type === type);
							if (items.length === 0) return null;
							const Icon = MENTION_ICONS[type];
							return (
								<CommandGroup key={type} heading={heading}>
									{items.map((mention) => (
										<CommandItem
											key={`${type}-${mention.id}`}
											value={`${type}-${mention.id}`}
											onSelect={() => {
												onPick(mention);
												onOpenChange(false);
												setSearch("");
											}}
										>
											<Icon />
											<span className="truncate">{mention.label}</span>
											{mention.detail ? (
												<span className="ml-auto truncate text-xs text-muted-foreground">
													{mention.detail}
												</span>
											) : null}
										</CommandItem>
									))}
								</CommandGroup>
							);
						})}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/** The model for the active provider; the choice is remembered on this computer. */
function ModelPicker() {
	const { data: status } = useAssistantStatus();
	const provider: AssistantProvider = status?.provider ?? "openrouter";
	const [open, setOpen] = useState(false);
	const {
		data: models = [],
		isPending,
		error,
	} = useAssistantModels(provider, open || Boolean(status?.ready));
	const setModel = useSetAssistantModel();
	const current = models.find((model) => model.id === status?.model);
	const label =
		current?.name ?? status?.model ?? (provider === "chatgpt" ? "Default model" : "Model");

	return (
		<ModelSelector open={open} onOpenChange={setOpen}>
			<ModelSelectorTrigger asChild>
				<PromptInputButton className="min-w-0 gap-1 px-2 text-xs text-muted-foreground">
					<span className="truncate">{label}</span>
					<ChevronsUpDown className="size-3 shrink-0 opacity-60" />
				</PromptInputButton>
			</ModelSelectorTrigger>
			<ModelSelectorContent title="Choose a model" className="sm:max-w-lg">
				<ModelSelectorInput placeholder="Search models…" />
				<ModelSelectorList className="max-h-[min(420px,60vh)]">
					<ModelSelectorEmpty>
						{isPending
							? "Loading models…"
							: error
								? "Couldn't load the models."
								: "No model found."}
					</ModelSelectorEmpty>
					<ModelSelectorGroup
						heading={
							provider === "openrouter"
								? "OpenRouter · price per million tokens (in / out)"
								: "Your ChatGPT plan"
						}
					>
						{models.map((model) => (
							<ModelSelectorItem
								key={model.id}
								value={`${model.name} ${model.id}`}
								onSelect={() => {
									setModel.mutate({ provider, model: model.id });
									setOpen(false);
								}}
							>
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate">{model.name}</span>
									<span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
										{model.id}
									</span>
								</span>
								<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
									{[
										model.images ? "Images" : null,
										model.files ? "PDF" : null,
										formatPrice(model.price),
									]
										.filter(Boolean)
										.join(" · ")}
								</span>
								{model.id === status?.model ? <Check className="text-brand-ink" /> : null}
							</ModelSelectorItem>
						))}
					</ModelSelectorGroup>
				</ModelSelectorList>
			</ModelSelectorContent>
		</ModelSelector>
	);
}
