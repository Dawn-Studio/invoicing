import { Toaster } from "@dawnstudio/ui/components/sonner";
import { TooltipProvider } from "@dawnstudio/ui/components/tooltip";
import { syncThemeWithSystem } from "@dawnstudio/ui/lib/theme";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { appHotkeys } from "./lib/hotkeys";
import { router } from "./router";
import "./styles.css";

document.documentElement.dataset.platform = window.api.platform;
document.documentElement.dataset.glass = String(window.api.glass);
syncThemeWithSystem();

// Data is local, so there's no network to retry or refetch on focus.
const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false, refetchOnWindowFocus: false, staleTime: Number.POSITIVE_INFINITY },
	},
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<HotkeysProvider appHotkeys={appHotkeys}>
					<RouterProvider router={router} />
				</HotkeysProvider>
				<Toaster position="bottom-right" />
			</TooltipProvider>
		</QueryClientProvider>
	</StrictMode>,
);
