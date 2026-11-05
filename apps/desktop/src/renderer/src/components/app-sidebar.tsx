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
import { mainNav, type PageId, pages } from "../navigation";

interface AppSidebarProps {
	active: PageId;
	onNavigate: (page: PageId) => void;
}

export function AppSidebar({ active, onNavigate }: AppSidebarProps) {
	const renderItem = (id: PageId) => {
		const { title, icon: Icon } = pages[id];
		return (
			<SidebarMenuItem key={id}>
				<SidebarMenuButton isActive={active === id} onClick={() => onNavigate(id)}>
					<Icon />
					<span>{title}</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	};

	return (
		<Sidebar>
			{/* Leaves room for the macOS traffic lights and lets the user drag the window. */}
			<SidebarHeader className="app-drag h-13 justify-end px-4 pb-2 in-data-[platform=darwin]:pl-22">
				<span className="text-sm font-semibold tracking-tight">Invoicing</span>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>{mainNav.map(renderItem)}</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>{renderItem("settings")}</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
