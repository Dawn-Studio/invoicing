import { SidebarTrigger, useSidebar } from "@dawnstudio/ui/components/sidebar";
import { cn } from "@dawnstudio/ui/lib/utils";
import { stagger } from "@dawnstudio/ui/motion";
import { ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import type * as React from "react";
import { Link } from "react-router";

interface PageProps {
	title: React.ReactNode;
	/** Shows "‹ label" before the title, linking to `to`. */
	back?: { to: string; label: string };
	actions?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

/** A routed screen: title bar (doubles as the window drag area) and a scrolling column of panels. */
export function Page({ title, back, actions, children, className }: PageProps) {
	const { state } = useSidebar();
	return (
		<div className="flex h-full min-h-0 flex-col">
			<header
				className={cn(
					"app-drag flex h-13 shrink-0 items-center gap-2 px-4",
					// With the sidebar hidden, the macOS traffic lights sit over the title bar.
					state === "collapsed" && "in-data-[platform=darwin]:pl-22",
				)}
			>
				<SidebarTrigger className="app-no-drag text-muted-foreground" />
				<div className="flex min-w-0 items-center gap-1 text-sm">
					{back ? (
						<>
							<Link
								to={back.to}
								className="app-no-drag flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
							>
								<ChevronLeft className="size-4" />
								{back.label}
							</Link>
							<span className="text-muted-foreground">/</span>
						</>
					) : null}
					<h1 className="truncate font-medium">{title}</h1>
				</div>
				<div className="app-no-drag ml-auto flex items-center gap-2">{actions}</div>
			</header>
			<main className="min-h-0 flex-1 overflow-y-auto">
				<motion.div
					variants={stagger(0.05)}
					initial="hidden"
					animate="visible"
					className={cn("mx-auto flex max-w-3xl flex-col gap-3 px-6 pt-2 pb-10", className)}
				>
					{children}
				</motion.div>
			</main>
		</div>
	);
}

/** Wraps a block of a page so it animates in with its siblings. */
export function PageSection({ className, ...props }: React.ComponentProps<typeof motion.div>) {
	return (
		<motion.div
			variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
			transition={{ type: "spring", stiffness: 300, damping: 32 }}
			className={className}
			{...props}
		/>
	);
}
