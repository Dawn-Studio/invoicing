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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@dawnstudio/ui/components/popover";
import { cn } from "@dawnstudio/ui/lib/utils";
import type { ChatStatus, FileUIPart } from "ai";
import {
	AtSign,
	Check,
	ChevronDown,
	FileText,
	Package,
	Paperclip,
	ShieldCheck,
	User,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AssistantModel, AssistantProvider, Mention } from "../../../../shared/contract";
import { makerOf, modelLabel, ProviderLogo } from "../../components/provider-logo";
import {
	useAssistantModels,
	useAssistantStatus,
	useSetAssistantModel,
	useSetAutoApprove,
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
	className?: string;
	textareaClassName?: string;
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
			{/* A container, so the toolbar can drop labels when the box is narrow (side panel). */}
			<div className="@container">
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
						className={props.className ?? "rounded-xl bg-background shadow-xs"}
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
								className={props.textareaClassName}
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
								<ApprovalToggle />
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
			</div>
		</PromptInputProvider>
	);
}

function Textarea({
	className,
	disabled,
	draft,
	onDraftUsed,
	onMention,
}: {
	className?: string;
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
			className={cn("max-h-60 min-h-12 text-[0.9375rem] select-text", className)}
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

/** Picks that make sense to anyone, with what they're good for. Shown when available. */
const RECOMMENDED: { id: string; note: string }[] = [
	{ id: "anthropic/claude-sonnet-5.5", note: "Balanced · best for most work" },
	{ id: "anthropic/claude-haiku-5.5", note: "Fastest and cheapest" },
	{ id: "anthropic/claude-opus-5.5", note: "Most capable, a bit slower" },
];
const MAKER_ORDER = ["anthropic", "openai", "google"];

/** "$" to "$$$$" from the input price per million tokens; numbers mean little to most people. */
function costTier(price: AssistantModel["price"]) {
	if (!price) return null;
	const value = price.input;
	if (value === 0) return "Free";
	return value < 0.5 ? "$" : value < 2.5 ? "$$" : value < 8 ? "$$$" : "$$$$";
}

/** The model for the active provider, shown with its maker's logo; remembered per computer. */
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
	const currentMaker = makerOf(status?.model ?? "", provider);
	const label = current
		? modelLabel(current.name)
		: provider === "chatgpt"
			? "ChatGPT"
			: "Choose a model";

	const choose = (model: string) => {
		setModel.mutate({ provider, model });
		setOpen(false);
	};

	const recommended =
		provider === "openrouter"
			? RECOMMENDED.flatMap(({ id, note }) => {
					const model = models.find((m) => m.id === id);
					return model ? [{ model, note }] : [];
				})
			: [];
	const byMaker = new Map<
		string,
		{ maker: ReturnType<typeof makerOf>; models: AssistantModel[] }
	>();
	for (const model of models) {
		const maker = makerOf(model.id, provider);
		const group = byMaker.get(maker.id) ?? { maker, models: [] };
		group.models.push(model);
		byMaker.set(maker.id, group);
	}
	const groups = [...byMaker.values()].sort((a, b) => {
		const rank = (id: string) => (MAKER_ORDER.includes(id) ? MAKER_ORDER.indexOf(id) : 99);
		return rank(a.maker.id) - rank(b.maker.id) || a.maker.name.localeCompare(b.maker.name);
	});

	const item = (model: AssistantModel, note?: string, key = model.id) => {
		const maker = makerOf(model.id, provider);
		const tier = costTier(model.price);
		return (
			<ModelSelectorItem
				key={key}
				value={`${key} ${model.name}`}
				onSelect={() => choose(model.id)}
				className="gap-3 py-2"
			>
				<ProviderLogo logo={maker.logo} className="text-foreground" />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate">{modelLabel(model.name)}</span>
					{note ? <span className="truncate text-xs text-muted-foreground">{note}</span> : null}
				</span>
				{tier ? (
					<span className="shrink-0 font-mono text-xs text-muted-foreground" title="Relative cost">
						{tier}
					</span>
				) : null}
				{model.id === status?.model ? <Check className="text-brand-ink" /> : null}
			</ModelSelectorItem>
		);
	};

	return (
		<ModelSelector open={open} onOpenChange={setOpen}>
			<ModelSelectorTrigger asChild>
				<PromptInputButton className="min-w-0 gap-1.5 px-2 text-xs text-muted-foreground">
					<ProviderLogo logo={currentMaker.logo} className="size-3.5 text-foreground/80" />
					<span className="truncate">{label}</span>
					<ChevronDown className="size-3 shrink-0 opacity-60" />
				</PromptInputButton>
			</ModelSelectorTrigger>
			<ModelSelectorContent title="Choose a model" className="sm:max-w-md">
				<ModelSelectorInput placeholder="Search models…" />
				<ModelSelectorList className="max-h-[min(440px,60vh)]">
					<ModelSelectorEmpty>
						{isPending
							? "Loading models…"
							: error
								? "Couldn't load the models."
								: "No model found."}
					</ModelSelectorEmpty>
					{provider === "chatgpt" ? (
						<ModelSelectorGroup heading="Included in your ChatGPT plan">
							{models.map((model) => item(model))}
						</ModelSelectorGroup>
					) : (
						<>
							{recommended.length ? (
								<ModelSelectorGroup heading="Recommended">
									{recommended.map(({ model, note }) =>
										item(model, note, `recommended-${model.id}`),
									)}
								</ModelSelectorGroup>
							) : null}
							{groups.map(({ maker, models: list }) => (
								<ModelSelectorGroup key={maker.id} heading={maker.name}>
									{list.map((model) => item(model))}
								</ModelSelectorGroup>
							))}
						</>
					)}
				</ModelSelectorList>
				{provider === "openrouter" ? (
					<p className="border-t px-3 py-2 text-xs text-muted-foreground">
						$ to $$$$ is how much a model costs on your OpenRouter account, from cheapest to most
						expensive.
					</p>
				) : null}
			</ModelSelectorContent>
		</ModelSelector>
	);
}

/** Ask before each change, or let the assistant make them; remembered per computer. */
function ApprovalToggle() {
	const { data: status } = useAssistantStatus();
	const setAutoApprove = useSetAutoApprove();
	const auto = status?.autoApprove ?? false;
	const options = [
		{
			value: false,
			icon: ShieldCheck,
			label: "Ask before changes",
			description: "You approve each new client, draft or item.",
		},
		{
			value: true,
			icon: Zap,
			label: "Make changes for me",
			description: "Faster. It still only creates drafts; you issue and send.",
		},
	];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<PromptInputButton
					className="gap-1.5 px-2 text-xs text-muted-foreground"
					title={auto ? "Making changes without asking" : "Asking before changes"}
				>
					{auto ? (
						<Zap className="size-3.5 text-brand-ink" />
					) : (
						<ShieldCheck className="size-3.5" />
					)}
					<span className="hidden @md:inline">{auto ? "Auto" : "Ask first"}</span>
				</PromptInputButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72">
				{options.map(({ value, icon: Icon, label, description }) => (
					<DropdownMenuItem
						key={label}
						onSelect={() => setAutoApprove.mutate({ autoApprove: value })}
						className="items-start gap-2.5 py-2"
					>
						<Icon className={value ? "mt-0.5 text-brand-ink" : "mt-0.5"} />
						<span className="flex flex-1 flex-col">
							<span className="font-medium">{label}</span>
							<span className="text-xs text-muted-foreground">{description}</span>
						</span>
						{auto === value ? <Check className="mt-0.5 text-brand-ink" /> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
