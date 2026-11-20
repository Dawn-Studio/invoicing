import { type InvoiceSummary, todayIso } from "@dawnstudio/core";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@dawnstudio/ui/components/tooltip";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useAppHotkeys, useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import {
	Calendar,
	Check,
	CircleCheck,
	Coins,
	FileDown,
	FileText,
	Plus,
	Search,
	Users,
	X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { FilterMenu } from "../../components/filter-menu";
import { Page, PageSection } from "../../components/page";
import { Shortcut } from "../../components/shortcut";
import { formatAmount, formatIsoDate } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import { useClients, useInvoices } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { displayStatus, dueText, StatusBadge } from "./invoice-row";
import {
	inTab,
	PERIODS,
	type Period,
	periodRange,
	STATUS_TABS,
	type StatusTab,
	tabCounts,
} from "./list-filters";
import { useStartInvoice } from "./use-start-invoice";

const revealLabel = window.api.platform === "darwin" ? "Show in Finder" : "Show in folder";

export function InvoicesPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const hotkeys = useAppHotkeys();
	const start = useStartInvoice();
	const today = todayIso();

	// Filters live in the URL.
	const [params, setParams] = useSearchParams();
	const tab = (params.get("status") as StatusTab | null) ?? "all";
	const clientId = params.get("client") ?? undefined;
	const period = (params.get("period") as Period | null) ?? undefined;
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

	const range = period ? periodRange(period, today) : undefined;
	const { data: all, isPending } = useInvoices({
		clientId,
		currency,
		search: query || undefined,
		...range,
	});
	const { data: everything } = useInvoices();
	const { data: clients = [] } = useClients({ includeArchived: true });

	const invoices = useMemo(
		() => (all ?? []).filter((invoice) => inTab(tab, displayStatus(invoice, today))),
		[all, tab, today],
	);
	const counts = useMemo(() => tabCounts(all ?? [], today), [all, today]);
	const currencies = useMemo(
		() => [...new Set((everything ?? []).map((invoice) => invoice.currency))].sort(),
		[everything],
	);
	const filtered = Boolean(clientId || period || currency || query);

	// Keyboard focus and selection.
	const [focused, setFocused] = useState<string | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const visibleIds = invoices.map((invoice) => invoice.id);
	const focusIndex = focused ? visibleIds.indexOf(focused) : -1;

	// Drop selection and focus that the current filters hide.
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
	/** What bulk actions apply to: the selection, or else the focused row. */
	const targets = selected.size > 0 ? [...selected] : focused ? [focused] : [];
	const targetInvoices = invoices.filter((invoice) => targets.includes(invoice.id));
	const payable = targetInvoices.filter((invoice) => invoice.status === "issued");
	const exportable = targetInvoices.filter((invoice) => invoice.number);

	const [busy, setBusy] = useState<"paid" | "export" | null>(null);
	const markPaid = async () => {
		if (payable.length === 0) return;
		setBusy("paid");
		try {
			const result = await rpc("invoices.markPaidMany", { ids: payable.map((i) => i.id) });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["invoices"] }),
				queryClient.invalidateQueries({ queryKey: ["clients"] }),
				queryClient.invalidateQueries({ queryKey: ["reports"] }),
			]);
			toast.success(`Marked ${result.paid} ${result.paid === 1 ? "invoice" : "invoices"} paid`);
			setSelected(new Set());
		} catch (error) {
			showSaveError(error);
		} finally {
			setBusy(null);
		}
	};
	const exportPdfs = async () => {
		if (exportable.length === 0) return;
		setBusy("export");
		try {
			const result = await rpc("invoices.exportPdfs", { ids: exportable.map((i) => i.id) });
			if (result) {
				void queryClient.invalidateQueries({ queryKey: ["invoices", "events"] });
				const firstPath = result.firstPath;
				toast.success(
					`Exported ${result.exported} ${result.exported === 1 ? "PDF" : "PDFs"}`,
					firstPath
						? {
								description: result.folder,
								action: {
									label: revealLabel,
									onClick: () => void rpc("files.reveal", { path: firstPath }).catch(showSaveError),
								},
							}
						: undefined,
				);
			}
		} catch (error) {
			showSaveError(error);
		} finally {
			setBusy(null);
		}
	};

	useHotkey(hotkeys["list.next"], () => move(1));
	useHotkey(hotkeys["list.prev"], () => move(-1));
	useHotkey(hotkeys["list.nextArrow"], () => move(1));
	useHotkey(hotkeys["list.prevArrow"], () => move(-1));
	useHotkey(hotkeys["list.open"], () => focused && navigate(`/invoices/${focused}`), {
		enabled: Boolean(focused),
	});
	useHotkey(hotkeys["list.toggle"], () => focused && toggle(focused), {
		enabled: Boolean(focused),
	});
	// Ignored in fields, so Cmd+A still selects text in the search box.
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
	useHotkey(hotkeys["list.markPaid"], () => void markPaid(), {
		enabled: payable.length > 0 && !busy,
	});
	useHotkey(hotkeys["list.export"], () => void exportPdfs(), {
		enabled: exportable.length > 0 && !busy,
	});

	const newButton = (label: string, size?: "sm") => (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button size={size} onClick={() => start.run()} disabled={start.isPending}>
					{start.isPending ? <Spinner /> : <Plus />}
					{label}
				</Button>
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2">
				New invoice <Shortcut hotkey={hotkeys["invoice.new"].hotkey} />
			</TooltipContent>
		</Tooltip>
	);

	if (!isPending && (everything ?? []).length === 0) {
		return (
			<Page title="Invoices" actions={newButton("New invoice", "sm")}>
				<PageSection>
					<Empty className="rounded-xl border bg-panel py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<FileText />
							</EmptyMedia>
							<EmptyTitle>No invoices yet</EmptyTitle>
							<EmptyDescription>
								Start a draft: pick a client, add what you're billing for, and issue it when it
								looks right.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>{newButton("Create your first invoice")}</EmptyContent>
					</Empty>
				</PageSection>
			</Page>
		);
	}

	const clientName = clients.find((c) => c.id === clientId)?.name;
	const outstanding = outstandingByCurrency(invoices);

	return (
		<Page title="Invoices" actions={newButton("New invoice", "sm")} className="max-w-5xl gap-4">
			<PageSection className="flex flex-col gap-3">
				<div className="flex items-center gap-1 overflow-x-auto">
					{STATUS_TABS.map(({ value, label }) => (
						<button
							key={value}
							type="button"
							aria-pressed={tab === value}
							onClick={() => setParam("status", value === "all" ? undefined : value)}
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
							placeholder="Search number, client or line items"
							className="h-8 pr-9 pl-8"
							aria-label="Search invoices"
						/>
						<Shortcut
							hotkey={hotkeys["list.search"].hotkey}
							className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
						/>
					</div>
					<FilterMenu
						icon={<Users />}
						label={clientName ?? "Client"}
						active={Boolean(clientId)}
						value={clientId ?? ""}
						onChange={(value) => setParam("client", value || undefined)}
						options={clients
							.filter((c) => !c.archivedAt || c.id === clientId)
							.map((c) => ({ value: c.id, label: c.name }))}
						anyLabel="All clients"
					/>
					<FilterMenu
						icon={<Calendar />}
						label={PERIODS.find((p) => p.value === period)?.label ?? "Period"}
						active={Boolean(period)}
						value={period ?? ""}
						onChange={(value) => setParam("period", value || undefined)}
						options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
						anyLabel="Any time"
					/>
					{currencies.length > 1 || currency ? (
						<FilterMenu
							icon={<Coins />}
							label={currency ?? "Currency"}
							active={Boolean(currency)}
							value={currency ?? ""}
							onChange={(value) => setParam("currency", value || undefined)}
							options={currencies.map((c) => ({ value: c, label: c }))}
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
								setParams(tab === "all" ? {} : { status: tab }, { replace: true });
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
							{invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
						</span>
						{outstanding.length > 0 ? (
							<span className="tabular-nums">
								Outstanding{" "}
								{outstanding
									.map(([cur, amount]) => `${formatAmount(amount, cur)} ${cur}`)
									.join(" · ")}
							</span>
						) : null}
					</div>
					{invoices.length === 0 ? (
						<p className="py-12 text-center text-[0.9375rem] text-muted-foreground">
							{isPending ? "" : "No invoices match these filters."}
						</p>
					) : (
						<ul ref={listRef} className="flex flex-col divide-y">
							{invoices.map((invoice) => (
								<ListRow
									key={invoice.id}
									invoice={invoice}
									today={today}
									focused={focused === invoice.id}
									selected={selected.has(invoice.id)}
									selecting={selected.size > 0}
									onToggle={() => toggle(invoice.id)}
									onOpen={() => navigate(`/invoices/${invoice.id}`)}
									onHover={() => setFocused(invoice.id)}
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
						<Button
							size="sm"
							variant="ghost"
							onClick={markPaid}
							disabled={payable.length === 0 || busy !== null}
						>
							{busy === "paid" ? <Spinner /> : <CircleCheck />}
							Mark paid
							<Shortcut hotkey={hotkeys["list.markPaid"].hotkey} />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={exportPdfs}
							disabled={exportable.length === 0 || busy !== null}
						>
							{busy === "export" ? <Spinner /> : <FileDown />}
							Export PDFs
							<Shortcut hotkey={hotkeys["list.export"].hotkey} />
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

/** Unpaid balance of open invoices in the list, per currency. */
function outstandingByCurrency(invoices: InvoiceSummary[]): [string, number][] {
	const totals = new Map<string, number>();
	for (const invoice of invoices) {
		if (invoice.status !== "issued") continue;
		totals.set(
			invoice.currency,
			(totals.get(invoice.currency) ?? 0) + invoice.total - invoice.amountPaid,
		);
	}
	return [...totals].filter(([, amount]) => amount > 0);
}

function ListRow({
	invoice,
	today,
	focused,
	selected,
	selecting,
	onToggle,
	onOpen,
	onHover,
}: {
	invoice: InvoiceSummary;
	today: string;
	focused: boolean;
	selected: boolean;
	selecting: boolean;
	onToggle: () => void;
	onOpen: () => void;
	onHover: () => void;
}) {
	const status = displayStatus(invoice, today);
	return (
		// Rows are driven by the list's hotkeys (J/K, Enter, X) rather than per-row key handlers.
		// biome-ignore lint/a11y/useKeyWithClickEvents: see above
		<li
			data-id={invoice.id}
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
				aria-label={`Select ${invoice.number ?? "draft"}`}
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
			<StatusBadge status={status} className="w-24" />
			<span
				className={cn(
					"w-32 shrink-0 truncate",
					invoice.number ? "font-mono text-sm" : "text-muted-foreground",
				)}
			>
				{invoice.number ?? "Draft"}
			</span>
			<span className="min-w-0 flex-1 truncate">{invoice.clientName ?? "No client"}</span>
			<span
				className={cn(
					"hidden w-32 shrink-0 text-right text-sm text-muted-foreground md:block",
					status === "overdue" && "text-destructive",
				)}
			>
				{invoice.status === "issued" ? dueText(invoice, today) : formatIsoDate(invoice.issueDate)}
			</span>
			<span
				className={cn(
					"w-28 shrink-0 text-right tabular-nums",
					status === "void" && "text-muted-foreground line-through",
				)}
			>
				{formatAmount(invoice.total, invoice.currency)}
			</span>
			<UnitTag className="shrink-0">{invoice.currency}</UnitTag>
		</li>
	);
}
