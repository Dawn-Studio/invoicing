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
import {
	FileText,
	LayoutDashboard,
	type LucideIcon,
	Package,
	Settings,
	SquarePen,
	Users,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { useStartInvoice } from "../features/invoices/use-start-invoice";
import { WorkspaceSwitcher } from "../features/workspaces/workspace-switcher";

interface NavEntry {
	to: string;
	label: string;
	icon: LucideIcon;
}

const overview: NavEntry[] = [{ to: "/", label: "Dashboard", icon: LayoutDashboard }];
const billing: NavEntry[] = [
	{ to: "/invoices", label: "Invoices", icon: FileText },
	{ to: "/clients", label: "Clients", icon: Users },
	{ to: "/items", label: "Items", icon: Package },
];

function NavItem({ to, label, icon: Icon }: NavEntry) {
	const { pathname } = useLocation();
	const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={active}
				className="relative h-7 gap-2.5 px-2 text-[0.9375rem] text-sidebar-foreground/85 data-[active=true]:bg-primary/15 data-[active=true]:font-medium dark:data-[active=true]:bg-primary/10 [&>svg]:text-muted-foreground data-[active=true]:[&>svg]:text-brand-ink"
			>
				<NavLink to={to}>
					<Icon />
					<span>{label}</span>
				</NavLink>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/** Linear-style: workspace menu and a compose button on top, compact grouped navigation. */
export function AppSidebar() {
	const start = useStartInvoice();
	return (
		<Sidebar variant="inset" className="border-r-0">
			{/* Room for the macOS traffic lights; the strip also drags the window. */}
			<div className="app-drag h-7 shrink-0 in-data-[platform=darwin]:h-9" />
			<SidebarHeader className="flex-row items-center gap-1 px-2 pt-0 pb-2">
				<div className="flex min-w-0 flex-1">
					<WorkspaceSwitcher />
				</div>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="New invoice"
							className="app-no-drag size-7 text-muted-foreground hover:text-foreground"
							disabled={start.isPending}
							onClick={() => start.run()}
						>
							<SquarePen />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">New invoice</TooltipContent>
				</Tooltip>
			</SidebarHeader>
			<SidebarContent className="gap-0">
				<SidebarGroup className="py-1">
					<SidebarGroupContent>
						<SidebarMenu className="gap-px">
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
						<SidebarMenu className="gap-px">
							{billing.map((item) => (
								<NavItem key={item.to} {...item} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter className="px-2 pb-2">
				<SidebarMenu>
					<NavItem to="/settings" label="Settings" icon={Settings} />
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
