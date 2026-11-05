import { SidebarTrigger, useSidebar } from "@dawnstudio/ui/components/sidebar";
import { cn } from "@dawnstudio/ui/lib/utils";

export function AppHeader({ title }: { title: string }) {
	const { state } = useSidebar();
	return (
		<header
			className={cn(
				"app-drag flex h-13 shrink-0 items-center gap-2 border-b px-4",
				// With the sidebar hidden, the macOS traffic lights sit over the header.
				state === "collapsed" && "in-data-[platform=darwin]:pl-22",
			)}
		>
			<SidebarTrigger className="app-no-drag" />
			<h1 className="text-sm font-medium">{title}</h1>
		</header>
	);
}
