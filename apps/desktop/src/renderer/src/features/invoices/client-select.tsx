import type { Client } from "@dawnstudio/core";
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

/** Searchable client picker. Archived clients only show up when already chosen. */
export function ClientSelect({
	id,
	clients,
	value,
	onChange,
	invalid,
}: {
	id?: string;
	clients: Client[];
	value: string | null;
	onChange: (client: Client) => void;
	invalid?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const selected = clients.find((client) => client.id === value) ?? null;
	const options = clients.filter((client) => !client.archivedAt || client.id === value);

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
					{selected ? (
						<span className="truncate">{selected.name}</span>
					) : (
						<span className="text-muted-foreground">Choose a client</span>
					)}
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
				<Command>
					<CommandInput placeholder="Search clients…" />
					<CommandList>
						<CommandEmpty>No client found.</CommandEmpty>
						<CommandGroup>
							{options.map((client) => (
								<CommandItem
									key={client.id}
									value={`${client.name} ${client.contactName} ${client.email} ${client.id}`}
									onSelect={() => {
										onChange(client);
										setOpen(false);
									}}
								>
									<Check className={cn(client.id === value ? "opacity-100" : "opacity-0")} />
									<span className="truncate">{client.name}</span>
									{client.contactName ? (
										<span className="truncate text-muted-foreground">{client.contactName}</span>
									) : null}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
