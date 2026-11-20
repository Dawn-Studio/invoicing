import { type Client, type InvoiceSummary, todayIso } from "@dawnstudio/core";
import { UnitTag } from "@dawnstudio/ui/components/amount";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@dawnstudio/ui/components/empty";
import { Input } from "@dawnstudio/ui/components/input";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useAppHotkeys, useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import {
	Archive,
	ArchiveRestore,
	Check,
	Coins,
	FileUp,
	Plus,
	Search,
	Users,
	X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { FilterMenu } from "../../components/filter-menu";
import { Page, PageSection } from "../../components/page";
import { Shortcut } from "../../components/shortcut";
import { formatAmount, formatIsoDate } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import { useClients, useInvoices } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { ImportClientsDialog } from "./import-clients-dialog";

const TABS = [
	{ value: "active", label: "Active" },
	{ value: "owing", label: "Owing" },
	{ value: "overdue", label: "Overdue" },
	{ value: "archived", label: "Archived" },
	{ value: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** What a client has been invoiced, worked out from the invoice list. */
interface ClientFigures {
	invoiced: number;
	lastIssued: string | null;
	/** Unpaid balance of open invoices, per currency. */
	outstanding: [string, number][];
	overdue: boolean;
}

const NONE: ClientFigures = { invoiced: 0, lastIssued: null, outstanding: [], overdue: false };

function figuresByClient(invoices: InvoiceSummary[], today: string) {
	const byClient = new Map<
		string,
		{
			invoiced: number;
			lastIssued: string | null;
			outstanding: Map<string, number>;
			overdue: boolean;
		}
	>();
	for (const invoice of invoices) {
		if (!invoice.clientId || invoice.status === "draft" || invoice.status === "void") continue;
		const entry = byClient.get(invoice.clientId) ?? {
			invoiced: 0,
			lastIssued: null,
			outstanding: new Map<string, number>(),
			overdue: false,
		};
		entry.invoiced += 1;
		if (!entry.lastIssued || invoice.issueDate > entry.lastIssued)
			entry.lastIssued = invoice.issueDate;
		if (invoice.status === "issued") {
			const due = invoice.total - invoice.amountPaid;
			if (due > 0) {
				entry.outstanding.set(
					invoice.currency,
					(entry.outstanding.get(invoice.currency) ?? 0) + due,
				);
				if (invoice.dueDate < today) entry.overdue = true;
			}
		}
		byClient.set(invoice.clientId, entry);
	}
	return new Map<string, ClientFigures>(
		[...byClient].map(([id, entry]) => [
			id,
			{ ...entry, outstanding: [...entry.outstanding].sort((a, b) => b[1] - a[1]) },
		]),
	);
}

function inTab(tab: Tab, client: Client, figures: ClientFigures) {
	switch (tab) {
		case "active":
			return !client.archivedAt;
		case "owing":
			return figures.outstanding.length > 0;
		case "overdue":
			return figures.overdue;
		case "archived":
			return Boolean(client.archivedAt);
		case "all":
			return true;
	}
}

/** Clients as a table, like the invoice list: tabs, search, keyboard focus, bulk actions. */
export function ClientsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const hotkeys = useAppHotkeys();
	const today = todayIso();
	const [importing, setImporting] = useState(false);

	const [params, setParams] = useSearchParams();
	const tab = (params.get("tab") as Tab | null) ?? "active";
	const currency = params.get("currency") ?? undefined;
	const setParam = (key: string, value: string | undefined) =>
		setParams(
			(current) => {
				const next = new URLSearchParams(current);
				if (value) next.set(key, value);
				else next.delete(key);
				return next;
			},
			{ replace: true },
		);

	const [search, setSearch] = useState(params.get("q") ?? "");
	const query = useDeferredValue(search.trim());
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the query should trigger this
	useEffect(() => setParam("q", query || undefined), [query]);

	const { data: matching, isPending } = useClients({
		search: query || undefined,
		includeArchived: true,
	});
	const { data: everyone } = useClients({ includeArchived: true });
	const { data: invoices = [] } = useInvoices();
	const figures = useMemo(() => figuresByClient(invoices, today), [invoices, today]);
	const figuresOf = (id: string) => figures.get(id) ?? NONE;

	const inCurrency = (client: Client) =>
		!currency ||
		client.currency === currency ||
		figuresOf(client.id).outstanding.some(([code]) => code === currency);
	const base = (matching ?? []).filter(inCurrency);
	const clients = base.filter((client) => inTab(tab, client, figuresOf(client.id)));
	const counts = Object.fromEntries(
		TABS.map(({ value }) => [
			value,
			base.filter((client) => inTab(value, client, figuresOf(client.id))).length,
		]),
	) as Record<Tab, number>;
	const currencies = [
		...new Set(
			(everyone ?? []).flatMap((client) => [
				...(client.currency ? [client.currency] : []),
				...figuresOf(client.id).outstanding.map(([code]) => code),
			]),
		),
	].sort();
	const outstanding = totalOutstanding(clients.map((client) => figuresOf(client.id)));
	const filtered = Boolean(query || currency);

	// Keyboard focus and selection, as in the invoice list.
	const [focused, setFocused] = useState<string | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const visibleIds = clients.map((client) => client.id);
	const focusIndex = focused ? visibleIds.indexOf(focused) : -1;

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the visible ids' content
	useEffect(() => {
		setSelected((current) => {
			const next = new Set([...current].filter((id) => visibleIds.includes(id)));
			return next.size === current.size ? current : next;
		});
		if (focused && !visibleIds.includes(focused)) setFocused(null);
	}, [visibleIds.join(), focused]);

	const move = (step: number) => {
		if (visibleIds.length === 0) return;
		const next = focusIndex < 0 ? (step > 0 ? 0 : visibleIds.length - 1) : focusIndex + step;
		const id = visibleIds[Math.max(0, Math.min(visibleIds.length - 1, next))];
		if (!id) return;
		setFocused(id);
		listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
	};
	const toggle = (id: string) =>
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	/** Bulk actions apply to the selection, or else the focused row. */
	const targets = clients.filter((client) =>
		selected.size > 0 ? selected.has(client.id) : client.id === focused,
	);
	const restoring = targets.length > 0 && targets.every((client) => client.archivedAt);
	const [busy, setBusy] = useState(false);
	const archiveOrRestore = async () => {
		if (targets.length === 0) return;
		setBusy(true);
		try {
			for (const client of targets) {
				await rpc(restoring ? "clients.unarchive" : "clients.archive", { id: client.id });
			}
			await queryClient.invalidateQueries({ queryKey: ["clients"] });
			const n = targets.length;
			toast.success(
				`${restoring ? "Restored" : "Archived"} ${n} ${n === 1 ? "client" : "clients"}`,
			);
			setSelected(new Set());
		} catch (error) {
			showSaveError(error);
		} finally {
			setBusy(false);
		}
	};

	useHotkey(hotkeys["list.next"], () => move(1));
	useHotkey(hotkeys["list.prev"], () => move(-1));
	useHotkey(hotkeys["list.nextArrow"], () => move(1));
	useHotkey(hotkeys["list.prevArrow"], () => move(-1));
	useHotkey(hotkeys["list.open"], () => focused && navigate(`/clients/${focused}`), {
		enabled: Boolean(focused),
	});
	useHotkey(hotkeys["list.toggle"], () => focused && toggle(focused), {
		enabled: Boolean(focused),
	});
	useHotkey(hotkeys["list.selectAll"], () => setSelected(new Set(visibleIds)), {
		enabled: visibleIds.length > 0,
		ignoreInputs: true,
	});
	useHotkey(
		hotkeys["list.clear"],
		() => {
			if (selected.size > 0) setSelected(new Set());
			else setFocused(null);
		},
		{ enabled: selected.size > 0 || Boolean(focused) },
	);
	useHotkey(hotkeys["list.search"], () => searchRef.current?.focus());
	useHotkey(hotkeys["list.archive"], () => void archiveOrRestore(), {
		enabled: targets.length > 0 && !busy,
	});

	const actions = (
		<>
			<Button size="sm" variant="ghost" onClick={() => setImporting(true)}>
				<FileUp />
				Import
			</Button>
			<Button size="sm" asChild>
				<Link to="/clients/new">
					<Plus />
					New client
				</Link>
			</Button>
		</>
	);

	if (!isPending && (everyone ?? []).length === 0 && !filtered) {
		return (
			<Page title="Clients" actions={actions}>
				<ImportClientsDialog open={importing} onOpenChange={setImporting} />
				<PageSection>
					<Empty className="rounded-xl border bg-panel py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Users />
							</EmptyMedia>
							<EmptyTitle>No clients yet</EmptyTitle>
							<EmptyDescription>
								Save a client once and their details fill in on every invoice you send them.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button asChild>
								<Link to="/clients/new">
									<Plus />
									Add your first client
								</Link>
							</Button>
						</EmptyContent>
					</Empty>
				</PageSection>
			</Page>
		);
	}

	return (
		<Page title="Clients" actions={actions} className="max-w-5xl gap-4">
			<ImportClientsDialog open={importing} onOpenChange={setImporting} />
			<PageSection className="flex flex-col gap-3">
				<div className="flex items-center gap-1 overflow-x-auto">
					{TABS.map(({ value, label }) => (
						<button
							key={value}
							type="button"
							aria-pressed={tab === value}
							onClick={() => setParam("tab", value === "active" ? undefined : value)}
							className={cn(
								"flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
								tab === value && "bg-accent font-medium text-foreground",
							)}
						>
							{label}
							<span className="text-xs text-muted-foreground tabular-nums">{counts[value]}</span>
						</button>
					))}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="relative min-w-56 flex-1">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							ref={searchRef}
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							onKeyDown={(event) => event.key === "Escape" && event.currentTarget.blur()}
							placeholder="Search name, contact or email"
							className="h-8 pr-9 pl-8"
							aria-label="Search clients"
						/>
						<Shortcut
							hotkey={hotkeys["list.search"].hotkey}
							className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
						/>
					</div>
					{currencies.length > 1 || currency ? (
						<FilterMenu
							icon={<Coins />}
							label={currency ?? "Currency"}
							active={Boolean(currency)}
							value={currency ?? ""}
							onChange={(value) => setParam("currency", value || undefined)}
							options={currencies.map((code) => ({ value: code, label: code }))}
							anyLabel="All currencies"
						/>
					) : null}
					{filtered ? (
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground"
							onClick={() => {
								setSearch("");
								setParams(tab === "active" ? {} : { tab }, { replace: true });
							}}
						>
							<X />
							Clear filters
						</Button>
					) : null}
				</div>
			</PageSection>

			<PageSection>
				<div className="overflow-hidden rounded-lg border bg-panel">
					<div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
						<span>
							{clients.length} {clients.length === 1 ? "client" : "clients"}
						</span>
						{outstanding.length > 0 ? (
							<span className="tabular-nums">
								Outstanding{" "}
								{outstanding
									.map(([code, amount]) => `${formatAmount(amount, code)} ${code}`)
									.join(" · ")}
							</span>
						) : null}
					</div>
					{clients.length === 0 ? (
						<p className="py-12 text-center text-[0.9375rem] text-muted-foreground">
							{isPending ? "" : query ? `No clients match “${query}”.` : "No clients here."}
						</p>
					) : (
						<ul ref={listRef} className="flex flex-col divide-y">
							{clients.map((client) => (
								<ClientRow
									key={client.id}
									client={client}
									figures={figuresOf(client.id)}
									focused={focused === client.id}
									selected={selected.has(client.id)}
									selecting={selected.size > 0}
									onToggle={() => toggle(client.id)}
									onOpen={() => navigate(`/clients/${client.id}`)}
									onHover={() => setFocused(client.id)}
								/>
							))}
						</ul>
					)}
				</div>
			</PageSection>

			{selected.size > 0 ? (
				<div className="pointer-events-none sticky bottom-5 z-10 flex justify-center">
					<div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-popover/70 p-1.5 pl-3.5 shadow-[0_12px_40px_-10px_rgb(0_0_0/0.35)] backdrop-blur-2xl backdrop-saturate-[1.8]">
						<span className="mr-2 text-sm font-medium tabular-nums">{selected.size} selected</span>
						<Button size="sm" variant="ghost" onClick={archiveOrRestore} disabled={busy}>
							{busy ? <Spinner /> : restoring ? <ArchiveRestore /> : <Archive />}
							{restoring ? "Restore" : "Archive"}
							<Shortcut hotkey={hotkeys["list.archive"].hotkey} />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label="Clear selection"
							onClick={() => setSelected(new Set())}
						>
							<X />
						</Button>
					</div>
				</div>
			) : null}
		</Page>
	);
}

function totalOutstanding(all: ClientFigures[]): [string, number][] {
	const totals = new Map<string, number>();
	for (const figures of all) {
		for (const [code, amount] of figures.outstanding) {
			totals.set(code, (totals.get(code) ?? 0) + amount);
		}
	}
	return [...totals];
}

/** Initials on a soft tint; quick to scan down a long list. */
function Initials({ name }: { name: string }) {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const initials = (
		words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : name.trim().slice(0, 2)
	).toUpperCase();
	return (
		<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[0.6875rem] font-semibold text-muted-foreground">
			{initials || "?"}
		</span>
	);
}

function ClientRow({
	client,
	figures,
	focused,
	selected,
	selecting,
	onToggle,
	onOpen,
	onHover,
}: {
	client: Client;
	figures: ClientFigures;
	focused: boolean;
	selected: boolean;
	selecting: boolean;
	onToggle: () => void;
	onOpen: () => void;
	onHover: () => void;
}) {
	const [main, ...more] = figures.outstanding;
	return (
		// Rows are driven by the list's hotkeys (J/K, Enter, X) rather than per-row key handlers.
		// biome-ignore lint/a11y/useKeyWithClickEvents: see above
		<li
			data-id={client.id}
			data-focused={focused || undefined}
			className={cn(
				"group relative flex h-11 cursor-default items-center gap-3 px-3 text-[0.9375rem] transition-colors",
				focused && "bg-accent/70",
				selected && "bg-primary/10 dark:bg-primary/8",
			)}
			onMouseMove={onHover}
			onClick={(event) => {
				if (event.metaKey || event.ctrlKey || event.shiftKey || selecting) onToggle();
				else onOpen();
			}}
		>
			<button
				type="button"
				aria-pressed={selected}
				aria-label={`Select ${client.name}`}
				onClick={(event) => {
					event.stopPropagation();
					onToggle();
				}}
				className={cn(
					"flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-opacity",
					selected ? "border-primary bg-primary text-primary-foreground" : "bg-background",
					!selected &&
						!selecting &&
						"opacity-0 group-hover:opacity-100 group-data-[focused]:opacity-100",
				)}
			>
				{selected ? <Check className="size-3" strokeWidth={3} /> : null}
			</button>
			<Initials name={client.name} />
			<span className="flex min-w-0 flex-1 items-baseline gap-2">
				<span className={cn("truncate", client.archivedAt && "text-muted-foreground")}>
					{client.name}
				</span>
				{client.contactName ? (
					<span className="hidden truncate text-sm text-muted-foreground sm:inline">
						{client.contactName}
					</span>
				) : null}
				{client.archivedAt ? (
					<span className="shrink-0 rounded border px-1.5 text-[0.6875rem] text-muted-foreground">
						Archived
					</span>
				) : null}
			</span>
			<span className="hidden w-56 shrink-0 truncate text-sm text-muted-foreground lg:block">
				{client.email}
			</span>
			<span className="hidden w-20 shrink-0 text-right text-sm text-muted-foreground tabular-nums md:block">
				{figures.invoiced
					? `${figures.invoiced} ${figures.invoiced === 1 ? "invoice" : "invoices"}`
					: "—"}
			</span>
			<span className="hidden w-28 shrink-0 text-right text-sm text-muted-foreground md:block">
				{figures.lastIssued ? formatIsoDate(figures.lastIssued) : "Never invoiced"}
			</span>
			<span
				className={cn(
					"w-28 shrink-0 text-right tabular-nums",
					figures.overdue && "text-destructive",
					!main && "text-muted-foreground",
				)}
				title={
					more.length
						? figures.outstanding
								.map(([code, amount]) => `${formatAmount(amount, code)} ${code}`)
								.join(" · ")
						: figures.overdue
							? "Has overdue invoices"
							: undefined
				}
			>
				{main ? formatAmount(main[1], main[0]) : "—"}
				{more.length ? (
					<span className="ml-1 text-xs text-muted-foreground">+{more.length}</span>
				) : null}
			</span>
			<span className="w-10 shrink-0">
				{main ? (
					<UnitTag>{main[0]}</UnitTag>
				) : client.currency ? (
					<UnitTag>{client.currency}</UnitTag>
				) : null}
			</span>
		</li>
	);
}
