import { SidebarInset, SidebarProvider, useSidebar } from "@dawnstudio/ui/components/sidebar";
import type * as React from "react";
import { Navigate, Outlet } from "react-router";
import { AppSidebar } from "./components/app-sidebar";
import { GlobalHotkeys } from "./components/global-hotkeys";
import {
	MIN_SCREEN,
	ResizeHandle,
	usePanelWidth,
	useWindowWidth,
} from "./components/resize-handle";
import { LoadError } from "./components/states";
import { ASSISTANT_PANEL, AssistantPanel } from "./features/assistant/assistant-panel";
import { useAssistantPanel } from "./lib/assistant";
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
	return <Shell />;
}

export const SIDEBAR = { fallback: 248, min: 200, max: 360 };

/** Sidebar, screen and assistant side by side; the sidebar's width is the user's. */
function Shell() {
	const { open: assistantOpen } = useAssistantPanel();
	const room = useWindowWidth() - MIN_SCREEN - (assistantOpen ? ASSISTANT_PANEL.min : 0);
	const max = Math.max(SIDEBAR.min, Math.min(SIDEBAR.max, room));
	const sidebar = usePanelWidth("sidebar", SIDEBAR.fallback, { min: SIDEBAR.min, max });
	return (
		<SidebarProvider
			className="h-full min-h-0"
			style={{ "--sidebar-width": `${sidebar.width}px` } as React.CSSProperties}
		>
			<GlobalHotkeys />
			<AppSidebar />
			<SidebarResizer {...sidebar} max={max} />
			<SidebarInset className="min-h-0 md:peer-data-[variant=inset]:my-1.5">
				<Outlet />
			</SidebarInset>
			<AssistantPanel sidebarWidth={sidebar.width} />
		</SidebarProvider>
	);
}

/** The sidebar's right edge, between it and the screen; hidden while the sidebar is collapsed. */
function SidebarResizer({
	width,
	setWidth,
	save,
	max,
}: ReturnType<typeof usePanelWidth> & { max: number }) {
	const { state } = useSidebar();
	if (state === "collapsed") return null;
	return (
		<ResizeHandle
			grows="right"
			label="Resize sidebar"
			width={width}
			min={SIDEBAR.min}
			max={max}
			onResize={setWidth}
			onCommit={save}
			onReset={() => {
				setWidth(SIDEBAR.fallback);
				save(SIDEBAR.fallback);
			}}
			className="fixed"
			style={{ left: width - 4 }}
		/>
	);
}
