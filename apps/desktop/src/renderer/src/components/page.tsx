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

/**
 * A routed screen: a frosted title bar (also the window drag area) that content scrolls
 * under, and a column of panels.
 */
export function Page({ title, back, actions, children, className }: PageProps) {
	const { state } = useSidebar();
	return (
		<div className="h-full min-h-0 overflow-y-auto" data-slot="page-scroll">
			<header
				className={cn(
					"app-drag sticky top-0 z-20 flex h-11 shrink-0 items-center gap-2 border-b bg-background/70 px-3 backdrop-blur-2xl backdrop-saturate-[1.8]",
					// With the sidebar hidden, the macOS traffic lights sit over the title bar.
					state === "collapsed" && "in-data-[platform=darwin]:pl-22",
				)}
			>
				<SidebarTrigger className="app-no-drag size-7 text-muted-foreground" />
				<div className="flex min-w-0 items-center gap-1.5 text-[0.9375rem]">
					{back ? (
						<>
							<Link
								to={back.to}
								className="app-no-drag flex items-center gap-0.5 rounded-md text-muted-foreground hover:text-foreground"
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
			<main>
				<motion.div
					variants={stagger(0.05)}
					initial="hidden"
					animate="visible"
					className={cn("mx-auto flex max-w-3xl flex-col gap-6 px-6 pt-6 pb-12", className)}
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
