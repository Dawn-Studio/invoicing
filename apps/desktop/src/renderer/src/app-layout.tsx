import { SidebarInset, SidebarProvider } from "@dawnstudio/ui/components/sidebar";
import { Navigate, Outlet } from "react-router";
import { AppSidebar } from "./components/app-sidebar";
import { useProfile } from "./lib/queries";

/** Screens with the sidebar. Until a business profile exists, everything goes to setup. */
export function AppLayout() {
	const { data: profile, isPending } = useProfile();
	if (isPending) return null;
	if (!profile) return <Navigate to="/welcome" replace />;

	return (
		<SidebarProvider className="h-full min-h-0">
			<AppSidebar />
			<SidebarInset className="min-h-0 md:peer-data-[variant=inset]:my-1.5">
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}
