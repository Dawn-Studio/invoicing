import { SidebarInset, SidebarProvider } from "@dawnstudio/ui/components/sidebar";
import { Navigate, Outlet } from "react-router";
import { AppSidebar } from "./components/app-sidebar";
import { GlobalHotkeys } from "./components/global-hotkeys";
import { LoadError } from "./components/states";
import { useProfile } from "./lib/queries";

/** Screens with the sidebar. Until a business profile exists, everything goes to setup. */
export function AppLayout() {
	const { data: profile, isPending, error, refetch } = useProfile();
	// Local data loads in a few milliseconds; a blank frame beats a flashing spinner.
	if (isPending) return null;
	if (error) {
		return (
			<div className="app-drag flex h-full items-center justify-center p-6">
				<LoadError
					error={error}
					retry={() => void refetch()}
					className="app-no-drag max-w-lg flex-none"
				/>
			</div>
		);
	}
	if (!profile) return <Navigate to="/welcome" replace />;

	return (
		<SidebarProvider className="h-full min-h-0">
			<GlobalHotkeys />
			<AppSidebar />
			<SidebarInset className="min-h-0 md:peer-data-[variant=inset]:my-1.5">
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}
