import type { CatalogItem } from "@dawnstudio/core";
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
import { Package } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { formatAmount } from "../../lib/format";
import { useCatalog } from "../../lib/queries";

/** "From items": search the catalog and add the picked item as a line. */
export function CatalogPicker({
	currency,
	onPick,
}: {
	currency: string;
	onPick: (item: CatalogItem) => void;
}) {
	const [open, setOpen] = useState(false);
	const { data: items = [] } = useCatalog();
	// Items in the invoice's currency first: their rate carries over as is.
	const sorted = [...items].sort(
		(a, b) => Number(b.currency === currency) - Number(a.currency === currency),
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button type="button" variant="ghost" size="sm">
					<Package />
					From items
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="end">
				{items.length === 0 ? (
					<div className="flex flex-col gap-2 p-4 text-sm">
						<p className="text-muted-foreground">
							No saved items yet. Save a line with the bookmark button, or add items on the Items
							page.
						</p>
						<Link to="/items" className="underline underline-offset-4">
							Go to Items
						</Link>
					</div>
				) : (
					<Command>
						<CommandInput placeholder="Search items…" />
						<CommandList>
							<CommandEmpty>No item found.</CommandEmpty>
							<CommandGroup>
								{sorted.map((item) => (
									<CommandItem
										key={item.id}
										value={`${item.description} ${item.id}`}
										onSelect={() => {
											onPick(item);
											setOpen(false);
										}}
										className="flex items-baseline gap-3"
									>
										<span className="min-w-0 flex-1 truncate">{item.description}</span>
										<span
											className={cn(
												"shrink-0 text-xs tabular-nums text-muted-foreground",
												item.currency !== currency && "opacity-60",
											)}
										>
											{formatAmount(item.unitPrice, item.currency)} {item.currency}
											{item.unit ? ` / ${item.unit}` : ""}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				)}
			</PopoverContent>
		</Popover>
	);
}
