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
import { FileText, LayoutDashboard, type LucideIcon, Settings, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { useProfile } from "../lib/queries";

const mainNav: { to: string; label: string; icon: LucideIcon }[] = [
	{ to: "/", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/invoices", label: "Invoices", icon: FileText },
	{ to: "/clients", label: "Clients", icon: Users },
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
	const { data: profile } = useProfile();
	return (
		<Sidebar>
			{/* Leaves room for the macOS traffic lights and lets the user drag the window. */}
			<SidebarHeader className="app-drag h-13 justify-center px-4 in-data-[platform=darwin]:pl-22">
				<span className="truncate text-sm font-medium">{profile?.name ?? "Invoicing"}</span>
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
