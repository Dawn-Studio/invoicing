import { todayIso } from "@dawnstudio/core";
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
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
	RowList,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { FileText, Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Page, PageSection } from "../../components/page";
import { useInvoices } from "../../lib/queries";
import { InvoiceRow } from "./invoice-row";
import { useStartInvoice } from "./use-start-invoice";

export function InvoicesPage() {
	const [search, setSearch] = useState("");
	const query = useDeferredValue(search.trim());
	const { data: invoices, isPending } = useInvoices({ search: query || undefined });
	const start = useStartInvoice();
	const today = todayIso();

	const newButton = (label: string, size?: "sm") => (
		<Button size={size} onClick={() => start.run()} disabled={start.isPending}>
			{start.isPending ? <Spinner /> : <Plus />}
			{label}
		</Button>
	);

	return (
		<Page title="Invoices" actions={newButton("New invoice", "sm")}>
			{!isPending && invoices?.length === 0 && query === "" ? (
				<PageSection>
					<Empty className="rounded-xl border bg-panel py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<FileText />
							</EmptyMedia>
							<EmptyTitle>No invoices yet</EmptyTitle>
							<EmptyDescription>
								Start a draft: pick a client, add what you're billing for, and issue it when it
								looks right.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>{newButton("Create your first invoice")}</EmptyContent>
					</Empty>
				</PageSection>
			) : (
				<PageSection>
					<Panel>
						<PanelHeader>
							<PanelTitle>All invoices</PanelTitle>
							<PanelLabel>{invoices ? `${invoices.length} shown` : ""}</PanelLabel>
						</PanelHeader>
						<PanelBody className="flex flex-col gap-5">
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search by number or client"
									className="pl-9"
									aria-label="Search invoices"
								/>
							</div>
							{invoices?.length === 0 ? (
								<p className="py-6 text-center text-[0.9375rem] text-muted-foreground">
									No invoices match “{query}”.
								</p>
							) : (
								<RowList className="my-0 [&>li]:py-0">
									{invoices?.map((invoice) => (
										<InvoiceRow key={invoice.id} invoice={invoice} today={today} />
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
