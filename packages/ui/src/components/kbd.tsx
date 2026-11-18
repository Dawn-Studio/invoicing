import { cn } from "@dawnstudio/ui/lib/utils";
import type * as React from "react";

/** A keyboard key, e.g. in a tooltip ("New invoice  C") or the shortcuts sheet. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-[5px] border bg-muted/60 px-1 font-sans text-[11px] font-medium text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export { Kbd };
