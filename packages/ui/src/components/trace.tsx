import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@dawnstudio/ui/components/collapsible";
import { cn } from "@dawnstudio/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import type * as React from "react";

/**
 * A quiet log of steps, one muted line each, that can open to show details (shadcn "trace",
 * the base of the AI Elements stack trace). Lines shimmer while running and turn red on error.
 */
function Trace({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="trace"
			className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}
			{...props}
		/>
	);
}

function TraceLine({
	className,
	status,
	...props
}: React.ComponentProps<"span"> & { status?: "running" | "error" | "pending" | "done" }) {
	return (
		<span
			data-slot="trace-line"
			data-status={status}
			className={cn(
				"flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors data-[status=error]:text-destructive data-[status=pending]:opacity-60 data-[status=running]:*:data-[slot=trace-title]:shimmer",
				className,
			)}
			{...props}
		/>
	);
}

function TraceIcon({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="trace-icon"
			aria-hidden="true"
			className={cn(
				"flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function TraceTitle({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="trace-title"
			className={cn("min-w-0 truncate motion-reduce:shimmer-none", className)}
			{...props}
		/>
	);
}

function TraceDescription({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="trace-description"
			className={cn("shrink-0 text-muted-foreground/70 tabular-nums", className)}
			{...props}
		/>
	);
}

function TraceCollapsible({ className, ...props }: React.ComponentProps<typeof Collapsible>) {
	return (
		<Collapsible
			data-slot="trace-collapsible"
			className={cn("flex w-full min-w-0 flex-col", className)}
			{...props}
		/>
	);
}

function TraceCollapsibleTrigger({
	className,
	children,
	...props
}: Omit<React.ComponentProps<typeof CollapsibleTrigger>, "asChild">) {
	return (
		<CollapsibleTrigger
			data-slot="trace-collapsible-trigger"
			className={cn(
				"group/trace-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 has-[[data-status=error]]:text-destructive [&_[data-slot=trace-line]]:text-inherit",
				className,
			)}
			{...props}
		>
			{children}
			<TraceIcon className="opacity-60 transition-transform group-data-[state=open]/trace-trigger:rotate-90">
				<ChevronRight className="size-3.5" />
			</TraceIcon>
		</CollapsibleTrigger>
	);
}

function TraceCollapsibleContent({
	className,
	children,
	...props
}: Omit<React.ComponentProps<typeof CollapsibleContent>, "asChild">) {
	return (
		<CollapsibleContent
			data-slot="trace-collapsible-content"
			className="min-w-0 overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
			{...props}
		>
			<div
				data-slot="trace-collapsible-content-inner"
				className={cn(
					"mt-1.5 mb-1 ml-[7px] min-w-0 border-l pr-1 pl-4 leading-relaxed break-words text-muted-foreground",
					className,
				)}
			>
				{children}
			</div>
		</CollapsibleContent>
	);
}

export {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
};
