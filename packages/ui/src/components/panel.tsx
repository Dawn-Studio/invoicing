import { cn } from "@dawnstudio/ui/lib/utils";
import type * as React from "react";

/**
 * The main layout block: a recessed title strip (`PanelHeader`) over a lighter rounded body
 * (`PanelBody`), with an optional note underneath (`PanelFooter`).
 */
function Panel({ className, ...props }: React.ComponentProps<"section">) {
	return (
		<section
			data-slot="panel"
			className={cn("flex flex-col overflow-hidden rounded-xl border bg-panel-header", className)}
			{...props}
		/>
	);
}

function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="panel-header"
			className={cn("flex min-h-13 items-center justify-between gap-3 px-6 py-2.5", className)}
			{...props}
		/>
	);
}

function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2
			data-slot="panel-title"
			className={cn("text-[0.9375rem] font-normal text-muted-foreground", className)}
			{...props}
		/>
	);
}

/** Small uppercase status text for the right side of a panel header, e.g. "DUE IN 4 DAYS". */
function PanelLabel({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="panel-label"
			className={cn("font-mono text-xs tracking-wider text-muted-foreground uppercase", className)}
			{...props}
		/>
	);
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="panel-body"
			className={cn(
				"-mx-px -mb-px flex-1 rounded-xl border bg-panel px-6 py-5 first:-mt-px",
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
			className={cn("px-6 py-4 text-sm text-muted-foreground", className)}
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
			className={cn("-my-5 flex flex-col divide-y [&>li]:py-5", className)}
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
