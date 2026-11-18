import { cn } from "@dawnstudio/ui/lib/utils";
import type * as React from "react";

/** A headline figure with its unit in a small tag, e.g. "1,217.00 [EUR]". */
function Amount({
	value,
	unit,
	className,
	...props
}: React.ComponentProps<"div"> & { value: React.ReactNode; unit?: React.ReactNode }) {
	return (
		<div data-slot="amount" className={cn("flex items-center gap-3", className)} {...props}>
			<span className="text-4xl font-medium tracking-tight tabular-nums">{value}</span>
			{unit ? <UnitTag>{unit}</UnitTag> : null}
		</div>
	);
}

function UnitTag({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="unit-tag"
			className={cn(
				"rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground uppercase",
				className,
			)}
			{...props}
		/>
	);
}

export { Amount, UnitTag };
