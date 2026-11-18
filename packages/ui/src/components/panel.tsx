import { cn } from "@dawnstudio/ui/lib/utils";
import type * as React from "react";

/**
 * The main layout block, Linear-style: a small title row (`PanelHeader`) above a bordered
 * card (`PanelBody`), with an optional note underneath (`PanelFooter`).
 */
function Panel({ className, ...props }: React.ComponentProps<"section">) {
	return <section data-slot="panel" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="panel-header"
			className={cn("flex min-h-8 items-center justify-between gap-3 px-1", className)}
			{...props}
		/>
	);
}

function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2
			data-slot="panel-title"
			className={cn("text-[0.9375rem] font-medium text-foreground", className)}
			{...props}
		/>
	);
}

/** Quiet status text for the right side of a panel header, e.g. "Due in 4 days". */
function PanelLabel({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="panel-label"
			className={cn("text-xs text-muted-foreground tabular-nums", className)}
			{...props}
		/>
	);
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="panel-body"
			className={cn(
				"flex-1 rounded-lg border bg-panel px-5 py-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)] dark:shadow-none",
				className,
			)}
			{...props}
		/>
	);
}

function PanelFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="panel-footer"
			className={cn("px-1 text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

/** Label/value rows, as in "Paid on ……… 14 Oct 2026". */
function DetailList({ className, ...props }: React.ComponentProps<"dl">) {
	return <dl data-slot="detail-list" className={cn("flex flex-col gap-1", className)} {...props} />;
}

function DetailRow({
	label,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	label: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div
			data-slot="detail-row"
			className={cn("flex items-baseline justify-between gap-6 py-1.5 text-[0.9375rem]", className)}
			{...props}
		>
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 text-right break-words">{children}</dd>
		</div>
	);
}

/** Rows separated by hairlines, for lists inside a panel body (clients, accounts, …). */
function RowList({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="row-list"
			className={cn("-my-4 flex flex-col divide-y [&>li]:py-4", className)}
			{...props}
		/>
	);
}

export {
	DetailList,
	DetailRow,
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	PanelLabel,
	PanelTitle,
	RowList,
};
