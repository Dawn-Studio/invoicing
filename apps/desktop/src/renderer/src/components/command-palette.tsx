import { todayIso } from "@dawnstudio/core";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@dawnstudio/ui/components/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { type Hotkey, useAppHotkeys } from "@tanstack/react-hotkeys";
import {
	ArchiveRestore,
	ChartColumn,
	Check,
	DatabaseBackup,
	FileText,
	Keyboard,
	LayoutDashboard,
	type LucideIcon,
	Monitor,
	Moon,
	Package,
	Settings,
	SquarePen,
	Sun,
	User,
	UserPlus,
	Users,
} from "lucide-react";
import { type ReactNode, useDeferredValue, useState } from "react";
import { useNavigate } from "react-router";
import type { Theme } from "../../../shared/contract";
import { displayStatus, StatusBadge } from "../features/invoices/invoice-row";
import { useWorkspaceActions } from "../features/workspaces/use-workspace-actions";
import { WorkspaceAvatar } from "../features/workspaces/workspace-avatar";
import { formatAmount } from "../lib/format";
import { applyPalette, PALETTE_OPTIONS } from "../lib/palettes";
import {
	usePalette,
	useRpcQuery,
	useSetPalette,
	useSetTheme,
	useTheme,
	useWorkspaces,
} from "../lib/queries";
import { Shortcut } from "./shortcut";

interface Action {
	id: string;
	label: string;
	group: "Actions" | "Go to" | "Appearance" | "Palette" | "Workspaces";
	icon: ReactNode;
	keywords?: string;
	hotkey?: Hotkey | null;
	checked?: boolean;
	run: () => void;
}

/** Every word of the query starts a word of the label or keywords ("ne inv" → "New invoice"). */
const matches = (query: string, ...texts: (string | null | undefined)[]) => {
	const words = texts
		.join(" ")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u);
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((part) => words.some((word) => word.startsWith(part)));
};

const icon = (Icon: LucideIcon) => <Icon />;

const RECENT = 5;
const RESULTS = 8;

/**
 * ⌘K: jump to any client or invoice, or run a command. Actions are filtered here; clients and
 * invoices come from the same search the lists use.
 */
export function CommandPalette({
	open,
	onOpenChange,
	actions,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** App actions that need state owned elsewhere (new invoice, backups, shortcuts). */
	actions: {
		newInvoice: () => void;
		backUpNow: () => void;
		restore: () => void;
		shortcuts: () => void;
	};
}) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("");
	const search = useDeferredValue(query.trim());
	const navigate = useNavigate();
	const hotkeys = useAppHotkeys();
	const { data: theme } = useTheme();
	const setTheme = useSetTheme();
	const { data: palette = window.api.palette } = usePalette();
	const setPalette = useSetPalette();
	const { data: workspaces } = useWorkspaces();
	const workspaceActions = useWorkspaceActions();

	const { data: clients = [] } = useRpcQuery(
		"clients.list",
		{ search, includeArchived: true },
		{ enabled: open && search !== "" },
	);
	const { data: invoices = [] } = useRpcQuery(
		"invoices.list",
		{ search },
		{ enabled: open && search !== "" },
	);
	// Without a query: the most recently changed invoices, to jump back into.
	const { data: recent = [] } = useRpcQuery("invoices.list", undefined, { enabled: open });

	const close = () => {
		onOpenChange(false);
		// Clear after the closing animation, so the list doesn't jump while it fades.
		setTimeout(() => setQuery(""), 150);
	};
	const run = (action: () => void) => () => {
		close();
		action();
	};

	const allActions = ((): Action[] => {
		const go = (
			id: string,
			label: string,
			to: string,
			Icon: LucideIcon,
			hotkey?: Hotkey | null,
		): Action => ({
			id: `go-${id}`,
			label,
			group: "Go to",
			icon: icon(Icon),
			keywords: "go open navigate",
			hotkey,
			run: () => navigate(to),
		});
		const themes: [Theme, string, LucideIcon, string][] = [
			["system", "Match system appearance", Monitor, "theme mode auto os"],
			["light", "Light appearance", Sun, "theme mode day"],
			["dark", "Dark appearance", Moon, "theme mode night"],
		];
		const others =
			workspaces?.workspaces.filter((workspace) => workspace.id !== workspaces.activeId) ?? [];
		return [
			{
				id: "new-invoice",
				label: "New invoice",
				group: "Actions",
				icon: icon(SquarePen),
				keywords: "create draft bill",
				hotkey: hotkeys["invoice.new"].hotkey,
				run: actions.newInvoice,
			},
			{
				id: "new-client",
				label: "New client",
				group: "Actions",
				icon: icon(UserPlus),
				keywords: "create add customer",
				run: () => navigate("/clients/new"),
			},
			{
				id: "backup",
				label: "Back up now",
				group: "Actions",
				icon: icon(DatabaseBackup),
				keywords: "backup save copy data",
				run: actions.backUpNow,
			},
			{
				id: "restore",
				label: "Restore from backup file…",
				group: "Actions",
				icon: icon(ArchiveRestore),
				keywords: "backup import data",
				run: actions.restore,
			},
			{
				id: "shortcuts",
				label: "Keyboard shortcuts",
				group: "Actions",
				icon: icon(Keyboard),
				keywords: "help keys hotkeys",
				hotkey: hotkeys["help.shortcuts"].hotkey,
				run: actions.shortcuts,
			},
			go("dashboard", "Dashboard", "/", LayoutDashboard, hotkeys["nav.dashboard"].hotkey),
			go("invoices", "Invoices", "/invoices", FileText, hotkeys["nav.invoices"].hotkey),
			go("clients", "Clients", "/clients", Users, hotkeys["nav.clients"].hotkey),
			go("items", "Items", "/items", Package, hotkeys["nav.items"].hotkey),
			go("reports", "Reports", "/reports", ChartColumn, hotkeys["nav.reports"].hotkey),
			go("settings", "Settings", "/settings", Settings, hotkeys["nav.settings"].hotkey),
			...themes.map(
				([value, label, Icon, keywords]): Action => ({
					id: `theme-${value}`,
					label,
					group: "Appearance",
					icon: icon(Icon),
					keywords,
					checked: theme === value,
					run: () => setTheme.mutate({ theme: value }),
				}),
			),
			...PALETTE_OPTIONS.map(
				({ value, label }): Action => ({
					id: `palette-${value}`,
					label: `${label} palette`,
					group: "Palette",
					icon: (
						<span data-palette={value} className="flex size-4 items-center justify-center">
							<span className="size-2.5 rounded-full bg-primary" />
						</span>
					),
					keywords: "colour color palette accent",
					checked: palette === value,
					run: () => {
						applyPalette(value);
						setPalette.mutate({ palette: value });
					},
				}),
			),
			...others.map(
				(workspace): Action => ({
					id: `workspace-${workspace.id}`,
					label: `Switch to ${workspace.name}`,
					group: "Workspaces",
					icon: (
						<WorkspaceAvatar
							id={workspace.id}
							name={workspace.name}
							className="size-4 text-[0.5rem]"
						/>
					),
					keywords: "workspace business company",
					run: () => void workspaceActions.switchTo(workspace.id),
				}),
			),
		];
	})();

	// Palettes only show up when searched for; ten of them would crowd the list.
	const visibleActions = allActions.filter((action) =>
		search ? matches(search, action.label, action.keywords) : action.group !== "Palette",
	);
	const invoiceResults = search
		? invoices.slice(0, RESULTS)
		: [...recent].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT);
	const clientResults = search ? clients.slice(0, RESULTS) : [];
	const today = todayIso();

	const groups = (["Actions", "Go to", "Appearance", "Palette", "Workspaces"] as const)
		.map((group) => ({ group, items: visibleActions.filter((a) => a.group === group) }))
		.filter(({ items }) => items.length > 0);
	// With a query, data matches matter more than commands; without one, actions come first.
	const actionGroups = groups.map(({ group, items }) => (
		<CommandGroup key={group} heading={group}>
			{items.map((action) => (
				<CommandItem key={action.id} value={action.id} onSelect={run(action.run)}>
					{action.icon}
					<span className="flex-1 truncate">{action.label}</span>
					{action.checked ? <Check className="text-brand-ink" /> : null}
					{action.hotkey ? <Shortcut hotkey={action.hotkey} className="opacity-80" /> : null}
				</CommandItem>
			))}
		</CommandGroup>
	));
	const invoiceGroup =
		invoiceResults.length > 0 ? (
			<CommandGroup heading={search ? "Invoices" : "Recent invoices"}>
				{invoiceResults.map((invoice) => (
					<CommandItem
						key={invoice.id}
						value={`invoice-${invoice.id}`}
						onSelect={run(() => navigate(`/invoices/${invoice.id}`))}
					>
						<FileText />
						<span className="w-36 shrink-0 truncate font-medium tabular-nums">
							{invoice.number ?? "Draft"}
						</span>
						<span className="min-w-0 flex-1 truncate text-muted-foreground">
							{invoice.clientName ?? "No client"}
						</span>
						<span className="text-muted-foreground tabular-nums">
							{formatAmount(invoice.total, invoice.currency)} {invoice.currency}
						</span>
						<StatusBadge status={displayStatus(invoice, today)} className="w-24 justify-end" />
					</CommandItem>
				))}
			</CommandGroup>
		) : null;
	const clientGroup =
		clientResults.length > 0 ? (
			<CommandGroup heading="Clients">
				{clientResults.map((client) => (
					<CommandItem
						key={client.id}
						value={`client-${client.id}`}
						onSelect={run(() => navigate(`/clients/${client.id}`))}
					>
						<User />
						<span className="min-w-0 flex-1 truncate">{client.name}</span>
						<span className="truncate text-muted-foreground">
							{client.archivedAt ? "Archived" : (client.email ?? "")}
						</span>
					</CommandItem>
				))}
			</CommandGroup>
		) : null;

	const empty = groups.length === 0 && invoiceResults.length === 0 && clientResults.length === 0;

	// Items in the order they're shown. Results arrive after typing, so cmdk's own selection can
	// point at an item that's gone; fall back to the first one so Enter always does something.
	const actionValues = groups.flatMap(({ items }) => items.map((action) => action.id));
	const invoiceValues = invoiceResults.map((invoice) => `invoice-${invoice.id}`);
	const clientValues = clientResults.map((client) => `client-${client.id}`);
	const firstGroup = groups[0]?.items.length ?? 0;
	const ordered = search
		? [...invoiceValues, ...clientValues, ...actionValues]
		: [...actionValues.slice(0, firstGroup), ...invoiceValues, ...actionValues.slice(firstGroup)];
	const value = ordered.includes(selected) ? selected : (ordered[0] ?? "");

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			<DialogContent
				showCloseButton={false}
				className="top-[16%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
			>
				<DialogTitle className="sr-only">Command palette</DialogTitle>
				<DialogDescription className="sr-only">
					Search clients and invoices, or run a command
				</DialogDescription>
				<Command
					shouldFilter={false}
					loop
					value={value}
					onValueChange={setSelected}
					className="rounded-none"
				>
					<CommandInput
						value={query}
						onValueChange={(next) => {
							setQuery(next);
							setSelected("");
						}}
						placeholder="Search invoices and clients, or type a command…"
						className="h-12 text-[0.9375rem]"
					/>
					<CommandList className="max-h-[min(420px,60vh)] p-1 [&_[data-slot=command-item]]:h-9 [&_[data-slot=command-item]]:px-2.5 [&_[data-slot=command-item]]:text-[0.9375rem] [&_[data-slot=command-item][data-selected=true]]:bg-primary/12">
						{empty ? <CommandEmpty>Nothing matches “{query.trim()}”</CommandEmpty> : null}
						{search ? (
							<>
								{invoiceGroup}
								{clientGroup}
								{actionGroups}
							</>
						) : (
							<>
								{actionGroups.slice(0, 1)}
								{invoiceGroup}
								{actionGroups.slice(1)}
							</>
						)}
					</CommandList>
				</Command>
				<div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<Shortcut hotkey="ArrowUp" />
						<Shortcut hotkey="ArrowDown" /> to move
					</span>
					<span className="flex items-center gap-1.5">
						<Shortcut hotkey="Enter" /> to open
					</span>
					<span className="ml-auto flex items-center gap-1.5">
						<Shortcut hotkey="Escape" /> to close
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}
