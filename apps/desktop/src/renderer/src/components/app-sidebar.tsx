import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@dawnstudio/ui/components/sidebar";
import { FileText, LayoutDashboard, type LucideIcon, Package, Settings, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { WorkspaceSwitcher } from "../features/workspaces/workspace-switcher";

const mainNav: { to: string; label: string; icon: LucideIcon }[] = [
	{ to: "/", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/invoices", label: "Invoices", icon: FileText },
	{ to: "/clients", label: "Clients", icon: Users },
	{ to: "/items", label: "Items", icon: Package },
];

function NavItem({ to, label, icon: Icon }: (typeof mainNav)[number]) {
	const { pathname } = useLocation();
	const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild isActive={active}>
				<NavLink to={to}>
					<Icon />
					<span>{label}</span>
				</NavLink>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function AppSidebar() {
	return (
		<Sidebar>
			{/* Leaves room for the macOS traffic lights and lets the user drag the window. */}
			<SidebarHeader className="app-drag h-13 justify-center px-4 in-data-[platform=darwin]:pl-22">
				<div className="flex min-w-0">
					<WorkspaceSwitcher />
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainNav.map((item) => (
								<NavItem key={item.to} {...item} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<NavItem to="/settings" label="Settings" icon={Settings} />
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
