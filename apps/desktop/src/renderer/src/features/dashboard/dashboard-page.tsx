import { Amount } from "@dawnstudio/ui/components/amount";
import {
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { Page, PageSection } from "../../components/page";
import { useProfile } from "../../lib/queries";

/** Placeholder until invoices exist (Phase 5 fills in real totals). */
export function DashboardPage() {
	const { data: profile } = useProfile();
	const currency = profile?.defaultCurrency ?? "EUR";
	return (
		<Page title="Dashboard">
			<PageSection>
				<Panel>
					<PanelHeader>
						<PanelTitle>Outstanding</PanelTitle>
						<PanelLabel>Soon</PanelLabel>
					</PanelHeader>
					<PanelBody>
						<Amount value="0.00" unit={currency} />
					</PanelBody>
					<PanelFooter>Totals appear here once you issue invoices.</PanelFooter>
				</Panel>
			</PageSection>
		</Page>
	);
}
