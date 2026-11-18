import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@dawnstudio/ui/components/empty";
import { FileText } from "lucide-react";
import { Page, PageSection } from "../../components/page";

/** Placeholder until the invoice editor (Phase 3). */
export function InvoicesPage() {
	return (
		<Page title="Invoices">
			<PageSection>
				<Empty className="rounded-xl border bg-panel py-16">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FileText />
						</EmptyMedia>
						<EmptyTitle>Invoices are next</EmptyTitle>
						<EmptyDescription>The invoice editor arrives in the next phase.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</PageSection>
		</Page>
	);
}
