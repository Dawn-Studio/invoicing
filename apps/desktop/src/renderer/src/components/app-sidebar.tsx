import { Button } from "@dawnstudio/ui/components/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@dawnstudio/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dawnstudio/ui/components/tooltip";
import { useAppHotkeys, useHotkey } from "@tanstack/react-hotkeys";
import {
	ChartColumn,
	ChevronLeft,
	FileText,
	House,
	LayoutDashboard,
	type LucideIcon,
	Package,
	Settings,
	Sparkles,
	SquarePen,
	Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type * as React from "react";
import { useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useStartInvoice } from "../features/invoices/use-start-invoice";
import { SETTINGS_SECTIONS, type SettingsGroup } from "../features/settings/sections";
import { SidebarUpdateNotice } from "../features/updates/update-notice";
import { WorkspaceAvatar } from "../features/workspaces/workspace-avatar";
import { WorkspaceSwitcher } from "../features/workspaces/workspace-switcher";
import { assistantPanel } from "../lib/assistant";
import { useWorkspaces } from "../lib/queries";
import { Shortcut } from "./shortcut";

interface NavEntry {
	to: string;
	label: string;
	icon: LucideIcon;
}

const overview: NavEntry[] = [
	{ to: "/home", label: "Home", icon: House },
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/reports", label: "Reports", icon: ChartColumn },
];
const billing: NavEntry[] = [
	{ to: "/invoices", label: "Invoices", icon: FileText },
	{ to: "/clients", label: "Clients", icon: Users },
	{ to: "/items", label: "Items", icon: Package },
];

function NavItem({ to, label, icon: Icon }: NavEntry) {
	const { pathname } = useLocation();
	const active = pathname === to || pathname.startsWith(`${to}/`);
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={active}
				className="relative h-9 gap-2.5 px-2.5 text-[0.9375rem] text-sidebar-foreground/85 data-[active=true]:bg-primary/15 data-[active=true]:font-medium dark:data-[active=true]:bg-primary/10 [&>svg]:text-muted-foreground data-[active=true]:[&>svg]:text-brand-ink"
			>
				<NavLink to={to}>
					<Icon />
					<span>{label}</span>
				</NavLink>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/** Where "Back to app" returns: the last screen outside settings. */
let lastAppPath = "/";

/**
 * Linear-style: the app's navigation, or, inside settings, the settings sections with a way
 * back. The two slide past each other when you go in and out of settings.
 */
export function AppSidebar() {
	const { pathname, search } = useLocation();
	const inSettings = pathname.startsWith("/settings");
	useEffect(() => {
		if (!inSettings) lastAppPath = pathname + search;
	}, [inSettings, pathname, search]);

	return (
		<Sidebar variant="inset" className="border-r-0">
			{/* Room for the macOS traffic lights; the strip also drags the window. */}
			<div className="app-drag h-7 shrink-0 in-data-[platform=darwin]:h-12" />
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.div
					key={inSettings ? "settings" : "app"}
					className="flex min-h-0 flex-1 flex-col"
					initial={{ opacity: 0, x: inSettings ? 24 : -24 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0 }}
					transition={{ type: "spring", stiffness: 420, damping: 38, opacity: { duration: 0.15 } }}
				>
					{inSettings ? <SettingsNav /> : <MainNav />}
				</motion.div>
			</AnimatePresence>
		</Sidebar>
	);
}

function MainNav() {
	const start = useStartInvoice();
	const hotkeys = useAppHotkeys();
	return (
		<>
			<SidebarHeader className="flex-row items-center gap-1 px-2 pt-0 pb-2">
				<div className="flex min-w-0 flex-1">
					<WorkspaceSwitcher />
				</div>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Assistant"
							className="app-no-drag size-8 text-muted-foreground hover:text-foreground"
							onClick={assistantPanel.toggle}
						>
							<Sparkles />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right" className="flex items-center gap-2">
						Assistant <Shortcut hotkey={hotkeys["assistant.toggle"].hotkey} />
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="New invoice"
							className="app-no-drag size-8 text-muted-foreground hover:text-foreground"
							disabled={start.isPending}
							onClick={() => start.run()}
						>
							<SquarePen />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right" className="flex items-center gap-2">
						New invoice <Shortcut hotkey={hotkeys["invoice.new"].hotkey} />
					</TooltipContent>
				</Tooltip>
			</SidebarHeader>
			<SidebarContent className="gap-0">
				<SidebarGroup className="py-1">
					<SidebarGroupContent>
						<SidebarMenu className="gap-0.5">
							{overview.map((item) => (
								<NavItem key={item.to} {...item} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup className="py-1">
					<SidebarGroupLabel className="h-7 px-2 text-xs font-medium text-muted-foreground">
						Billing
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-0.5">
							{billing.map((item) => (
								<NavItem key={item.to} {...item} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter className="gap-0 px-2 pb-2">
				<SidebarUpdateNotice />
				<SidebarMenu>
					<NavItem to="/settings" label="Settings" icon={Settings} />
				</SidebarMenu>
			</SidebarFooter>
		</>
	);
}

function SettingsNav() {
	const navigate = useNavigate();
	const hotkeys = useAppHotkeys();
	const { data: workspaces } = useWorkspaces();
	// Esc leaves settings, like Linear; it first leaves a field you're typing in, and leaves
	// open dialogs and menus to close themselves.
	useHotkey(hotkeys["settings.close"], () => {
		const active = document.activeElement;
		if (
			active instanceof HTMLElement &&
			active.matches("input, textarea, select, [contenteditable]")
		) {
			active.blur();
			return;
		}
		if (
			document.querySelector(
				'[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
			)
		) {
			return;
		}
		navigate(lastAppPath);
	});
	const workspace = workspaces?.workspaces.find((w) => w.id === workspaces.activeId);
	const groups: { group: SettingsGroup; label: React.ReactNode }[] = [
		{
			group: "workspace",
			label: workspace ? (
				<span className="flex min-w-0 items-center gap-2">
					<WorkspaceAvatar
						id={workspace.id}
						name={workspace.name}
						avatarFile={workspace.avatarFile}
						className="size-4 text-[8px]"
					/>
					<span className="truncate">{workspace.name}</span>
				</span>
			) : (
				"Workspace"
			),
		},
		{ group: "app", label: "App" },
	];

	return (
		<>
			<SidebarHeader className="px-2 pt-0 pb-2">
				<button
					type="button"
					onClick={() => navigate(lastAppPath)}
					className="app-no-drag flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.9375rem] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
				>
					<ChevronLeft className="size-4 text-muted-foreground" />
					Settings
				</button>
			</SidebarHeader>
			<SidebarContent className="gap-0">
				{groups.map(({ group, label }) => (
					<SidebarGroup key={group} className="py-1">
						<SidebarGroupLabel className="h-7 px-2 text-xs font-medium text-muted-foreground">
							{label}
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu className="gap-0.5">
								{SETTINGS_SECTIONS.filter((section) => section.group === group).map((section) => (
									<NavItem
										key={section.id}
										to={`/settings/${section.id}`}
										label={section.label}
										icon={section.icon}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter className="px-4 pb-3 text-xs text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<Shortcut hotkey={hotkeys["settings.close"].hotkey} /> to go back
				</span>
			</SidebarFooter>
		</>
	);
}
