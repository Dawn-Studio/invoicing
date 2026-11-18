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
import { FileUp, Plus, Search, Users } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router";
import { Page, PageSection } from "../../components/page";
import { joinParts } from "../../lib/format";
import { useClients } from "../../lib/queries";
import { ImportClientsDialog } from "./import-clients-dialog";

export function ClientsPage() {
	const [search, setSearch] = useState("");
	const [includeArchived, setIncludeArchived] = useState(false);
	const [importing, setImporting] = useState(false);
	const query = useDeferredValue(search.trim());
	const { data: clients, isPending } = useClients({ search: query || undefined, includeArchived });
	const isFiltered = query !== "" || includeArchived;

	return (
		<Page
			title="Clients"
			actions={
				<>
					<Button size="sm" variant="ghost" onClick={() => setImporting(true)}>
						<FileUp />
						Import
					</Button>
					<Button size="sm" asChild>
						<Link to="/clients/new">
							<Plus />
							New client
						</Link>
					</Button>
				</>
			}
		>
			<ImportClientsDialog open={importing} onOpenChange={setImporting} />
			{!isPending && clients?.length === 0 && !isFiltered ? (
				<PageSection>
					<Empty className="rounded-xl border bg-panel py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Users />
							</EmptyMedia>
							<EmptyTitle>No clients yet</EmptyTitle>
							<EmptyDescription>
								Save a client once and their details fill in on every invoice you send them.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button asChild>
								<Link to="/clients/new">
									<Plus />
									Add your first client
								</Link>
							</Button>
						</EmptyContent>
					</Empty>
				</PageSection>
			) : (
				<PageSection>
					<Panel>
						<PanelHeader>
							<PanelTitle>{includeArchived ? "All clients" : "Clients"}</PanelTitle>
							<div className="flex items-center gap-4">
								<div className="flex items-center gap-2">
									<Switch
										id="show-archived"
										checked={includeArchived}
										onCheckedChange={setIncludeArchived}
										size="sm"
									/>
									<Label htmlFor="show-archived" className="font-normal text-muted-foreground">
										Show archived
									</Label>
								</div>
								<PanelLabel>{clients ? `${clients.length} shown` : ""}</PanelLabel>
							</div>
						</PanelHeader>
						<PanelBody className="flex flex-col gap-5">
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search by name, contact or email"
									className="pl-9"
									aria-label="Search clients"
								/>
							</div>
							{clients?.length === 0 ? (
								<p className="py-6 text-center text-[0.9375rem] text-muted-foreground">
									No clients match “{query}”.
								</p>
							) : (
								<RowList className="my-0 [&>li]:py-0">
									{clients?.map((client) => (
										<li key={client.id}>
											<Link
												to={`/clients/${client.id}`}
												className="-mx-3 flex items-center gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-accent/60"
											>
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2 text-[0.9375rem]">
														{client.name}
														{client.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
													</div>
													<div className="truncate text-sm text-muted-foreground">
														{joinParts(
															client.contactName,
															client.email,
															client.address.country,
															client.taxId ? client.taxId : null,
														) || "No contact details"}
													</div>
												</div>
												{client.currency ? <UnitTag>{client.currency}</UnitTag> : null}
											</Link>
										</li>
									))}
								</RowList>
							)}
						</PanelBody>
					</Panel>
				</PageSection>
			)}
		</Page>
	);
}
