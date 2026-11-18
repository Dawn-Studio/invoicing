import { Button } from "@dawnstudio/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@dawnstudio/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@dawnstudio/ui/components/popover";
import { cn } from "@dawnstudio/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { currencyName, currencyOptions } from "../lib/currencies";

interface CurrencySelectProps {
	id?: string;
	value: string | null;
	onChange: (value: string | null) => void;
	/** When set, offers a "no currency" choice with this label (e.g. "Business default"). */
	emptyLabel?: string;
	invalid?: boolean;
}

/** Searchable currency picker: type a code or a name. */
export function CurrencySelect({ id, value, onChange, emptyLabel, invalid }: CurrencySelectProps) {
	const [open, setOpen] = useState(false);
	const select = (next: string | null) => {
		onChange(next);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-invalid={invalid}
					className="w-full justify-between font-normal"
				>
					{value ? (
						<span className="truncate">
							<span className="font-mono">{value}</span>
							<span className="text-muted-foreground"> · {currencyName(value)}</span>
						</span>
					) : (
						<span className="text-muted-foreground">{emptyLabel ?? "Choose a currency"}</span>
					)}
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
				<Command>
					<CommandInput placeholder="Search currencies…" />
					<CommandList>
						<CommandEmpty>No currency found.</CommandEmpty>
						<CommandGroup>
							{emptyLabel ? (
								<CommandItem value="__none" onSelect={() => select(null)}>
									<Check className={cn(value === null ? "opacity-100" : "opacity-0")} />
									{emptyLabel}
								</CommandItem>
							) : null}
							{currencyOptions().map((option) => (
								<CommandItem
									key={option.code}
									value={`${option.code} ${option.name}`}
									onSelect={() => select(option.code)}
								>
									<Check className={cn(value === option.code ? "opacity-100" : "opacity-0")} />
									<span className="w-10 font-mono">{option.code}</span>
									<span className="truncate text-muted-foreground">{option.name}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
