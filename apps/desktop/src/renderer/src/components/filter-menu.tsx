import { Button } from "@dawnstudio/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { cn } from "@dawnstudio/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** A list filter as an outline button with a menu of choices ("Client ▾", "Period ▾"). */
export function FilterMenu({
	icon,
	label,
	active,
	value,
	onChange,
	options,
	anyLabel,
}: {
	icon: ReactNode;
	label: string;
	active: boolean;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
	anyLabel: string;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn("max-w-52 font-normal", active && "border-brand-ink/40 text-foreground")}
				>
					{icon}
					<span className="truncate">{label}</span>
					<ChevronDown className="text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-80 min-w-48">
				<DropdownMenuRadioGroup value={value} onValueChange={onChange}>
					<DropdownMenuRadioItem value="">{anyLabel}</DropdownMenuRadioItem>
					{options.length > 0 ? <DropdownMenuSeparator /> : null}
					{options.length === 0 ? (
						<DropdownMenuLabel className="font-normal text-muted-foreground">
							None yet
						</DropdownMenuLabel>
					) : null}
					{options.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
