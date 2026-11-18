import { formatRate } from "@dawnstudio/core";
import { UnitTag } from "@dawnstudio/ui/components/amount";
import { Badge } from "@dawnstudio/ui/components/badge";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@dawnstudio/ui/components/empty";
import { Input } from "@dawnstudio/ui/components/input";
import { Label } from "@dawnstudio/ui/components/label";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
	RowList,
} from "@dawnstudio/ui/components/panel";
import { Switch } from "@dawnstudio/ui/components/switch";
import { Package, Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Page, PageSection } from "../../components/page";
import { formatAmount, joinParts } from "../../lib/format";
import { useCatalog, useTaxRates } from "../../lib/queries";
import { CatalogItemDialog, type ItemDialogState } from "./catalog-item-dialog";

/** The catalog: services and products you bill often. */
export function ItemsPage() {
	const [search, setSearch] = useState("");
	const [includeArchived, setIncludeArchived] = useState(false);
	const [dialog, setDialog] = useState<ItemDialogState>({ mode: "closed" });
	const query = useDeferredValue(search.trim());
	const { data: items, isPending } = useCatalog({ search: query || undefined, includeArchived });
	const { data: taxRates = [] } = useTaxRates();
	const isFiltered = query !== "" || includeArchived;
	const add = () => setDialog({ mode: "new" });

	return (
		<Page
			title="Items"
			actions={
				<Button size="sm" onClick={add}>
					<Plus />
					New item
				</Button>
			}
		>
			<CatalogItemDialog state={dialog} onClose={() => setDialog({ mode: "closed" })} />
			{!isPending && items?.length === 0 && !isFiltered ? (
				<PageSection>
					<Empty className="rounded-xl border bg-panel py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Package />
							</EmptyMedia>
							<EmptyTitle>No saved items yet</EmptyTitle>
							<EmptyDescription>
								Save what you bill often, like an hourly rate or a monthly retainer, and add it to
								an invoice in one pick.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button onClick={add}>
								<Plus />
								Add your first item
							</Button>
						</EmptyContent>
					</Empty>
				</PageSection>
			) : (
				<PageSection>
					<Panel>
						<PanelHeader>
							<PanelTitle>{includeArchived ? "All items" : "Items"}</PanelTitle>
							<div className="flex items-center gap-4">
								<div className="flex items-center gap-2">
									<Switch
										id="show-archived-items"
										checked={includeArchived}
										onCheckedChange={setIncludeArchived}
										size="sm"
									/>
									<Label
										htmlFor="show-archived-items"
										className="font-normal text-muted-foreground"
									>
										Show archived
									</Label>
								</div>
								<PanelLabel>{items ? `${items.length} shown` : ""}</PanelLabel>
							</div>
						</PanelHeader>
						<PanelBody className="flex flex-col gap-5">
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search items"
									className="pl-9"
									aria-label="Search items"
								/>
							</div>
							{items?.length === 0 ? (
								<p className="py-6 text-center text-[0.9375rem] text-muted-foreground">
									No items match “{query}”.
								</p>
							) : (
								<RowList className="my-0 [&>li]:py-0">
									{items?.map((item) => {
										const tax = taxRates.find((rate) => rate.id === item.taxRateId);
										return (
											<li key={item.id}>
												<button
													type="button"
													onClick={() => setDialog({ mode: "edit", item })}
													className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-4 text-left transition-colors hover:bg-accent/60"
												>
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2 text-[0.9375rem]">
															<span className="truncate">{item.description}</span>
															{item.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
														</div>
														<div className="truncate text-sm text-muted-foreground">
															{joinParts(
																item.unit ? `per ${item.unit}` : "fixed",
																tax ? `${tax.name} ${formatRate(tax.rate)}%` : "no tax",
															)}
														</div>
													</div>
													<span className="tabular-nums">
														{formatAmount(item.unitPrice, item.currency)}
													</span>
													<UnitTag>{item.currency}</UnitTag>
												</button>
											</li>
										);
									})}
								</RowList>
							)}
						</PanelBody>
					</Panel>
				</PageSection>
			)}
		</Page>
	);
}
