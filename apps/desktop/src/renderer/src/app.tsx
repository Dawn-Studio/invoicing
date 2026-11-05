import { SidebarInset, SidebarProvider } from "@dawnstudio/ui/components/sidebar";
import { TooltipProvider } from "@dawnstudio/ui/components/tooltip";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { AppHeader } from "./components/app-header";
import { AppSidebar } from "./components/app-sidebar";
import { PagePlaceholder } from "./components/page-placeholder";
import { type PageId, pages } from "./navigation";

export function App() {
	const [active, setActive] = useState<PageId>("dashboard");
	const page = pages[active];

	return (
		<TooltipProvider>
			<SidebarProvider className="h-full min-h-0">
				<AppSidebar active={active} onNavigate={setActive} />
				<SidebarInset className="min-h-0">
					<AppHeader title={page.title} />
					<main className="flex-1 overflow-y-auto p-6">
						<AnimatePresence mode="wait">
							<PagePlaceholder key={page.id} page={page} />
						</AnimatePresence>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</TooltipProvider>
	);
}
