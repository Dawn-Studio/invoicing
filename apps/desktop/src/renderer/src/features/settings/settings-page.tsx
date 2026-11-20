import { formatRate, type PaymentAccount, type TaxRate } from "@dawnstudio/core";
import { UnitTag } from "@dawnstudio/ui/components/amount";
import { Badge } from "@dawnstudio/ui/components/badge";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelTitle,
	RowList,
} from "@dawnstudio/ui/components/panel";
import { Ellipsis, Plus } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { Navigate, useParams } from "react-router";
import { toast } from "sonner";
import { ShortcutList } from "../../components/global-hotkeys";
import { Page, PageSection } from "../../components/page";
import { showSaveError } from "../../lib/forms";
import {
	useArchivePaymentAccount,
	useArchiveTaxRate,
	usePaymentAccounts,
	useProfile,
	useTaxRates,
	useUpdatePaymentAccount,
	useUpdateTaxRate,
} from "../../lib/queries";
import { StartScreenPanel } from "../home/start-screen";
import { LogoPanel } from "../profile/logo-panel";
import { ProfileForm, type ProfileSection } from "../profile/profile-form";
import { AboutPanel } from "../updates/about-panel";
import { WorkspacePanel } from "../workspaces/workspace-panel";
import { PalettePanel, ThemePanel } from "./appearance-panel";
import { AssistantSettings } from "./assistant-settings";
import { BrandingPanel } from "./branding-panel";
import { DataPanel } from "./data-panel";
import { EmailPanel } from "./email-panel";
import { ExportPanel } from "./export-panel";
import { PaymentAccountForm } from "./payment-account-form";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./sections";
import { TaxRateForm } from "./tax-rate-form";

/** `/settings/:section`: one settings page, picked in the settings sidebar. */
export function SettingsPage() {
	const { section: id } = useParams();
	const section = SETTINGS_SECTIONS.find((s) => s.id === id);
	if (!section) return <Navigate to="/settings/general" replace />;

	return (
		<Page title="Settings" className="max-w-2xl gap-5">
			<PageSection className="flex flex-col gap-1.5 pt-2 pb-3">
				<h2 className="text-2xl font-semibold tracking-tight">{section.label}</h2>
				<p className="text-[0.9375rem] text-muted-foreground">{section.description}</p>
			</PageSection>
			<SectionContent id={section.id} />
		</Page>
	);
}

function SectionContent({ id }: { id: SettingsSectionId }) {
	const { data: profile } = useProfile();
	const profileForm = (sections: ProfileSection[], afterBusiness?: React.ReactNode) =>
		profile ? (
			<ProfileForm
				key={id}
				profile={profile}
				sections={sections}
				submitLabel="Save changes"
				onSaved={() => toast.success("Saved")}
				afterBusiness={afterBusiness}
			/>
		) : null;

	switch (id) {
		case "general":
			return (
				<PageSection>
					<WorkspacePanel />
				</PageSection>
			);
		case "business":
			return profileForm(["business", "address"], <LogoPanel />);
		case "invoices":
			return (
				<>
					{profileForm(["invoicing"])}
					<PageSection>
						<ExportPanel />
					</PageSection>
				</>
			);
		case "design":
			return profile ? (
				<PageSection>
					<BrandingPanel key={profile.updatedAt} profile={profile} />
				</PageSection>
			) : null;
		case "payments":
			return (
				<PageSection>
					<PaymentAccountsPanel defaultCurrency={profile?.defaultCurrency} />
				</PageSection>
			);
		case "taxes":
			return (
				<PageSection>
					<TaxRatesPanel />
				</PageSection>
			);
		case "email":
			return (
				<PageSection>
					<EmailPanel />
				</PageSection>
			);
		case "appearance":
			return (
				<>
					<PageSection>
						<StartScreenPanel />
					</PageSection>
					<PageSection>
						<ThemePanel />
					</PageSection>
					<PageSection>
						<PalettePanel />
					</PageSection>
				</>
			);
		case "assistant":
			return (
				<PageSection className="flex flex-col gap-5">
					<AssistantSettings />
				</PageSection>
			);
		case "shortcuts":
			return (
				<PageSection>
					<Panel>
						<PanelBody>
							<ShortcutList />
						</PanelBody>
					</Panel>
				</PageSection>
			);
		case "data":
			return (
				<PageSection>
					<DataPanel />
				</PageSection>
			);
		case "about":
			return (
				<PageSection>
					<AboutPanel />
				</PageSection>
			);
	}
}

/** Dialog state: closed, adding a new record, or editing one. */
type Editing<T> = { mode: "closed" } | { mode: "new" } | { mode: "edit"; record: T };

function PaymentAccountsPanel({ defaultCurrency }: { defaultCurrency?: string }) {
	const { data: accounts = [] } = usePaymentAccounts();
	const update = useUpdatePaymentAccount();
	const archive = useArchivePaymentAccount();
	const [editing, setEditing] = useState<Editing<PaymentAccount>>({ mode: "closed" });
	const close = () => setEditing({ mode: "closed" });

	const makeDefault = (account: PaymentAccount) =>
		update
			.mutateAsync({ id: account.id, data: { ...account, isDefault: true } })
			.catch((e) => showSaveError(e));
	const remove = (account: PaymentAccount) =>
		archive
			.mutateAsync({ id: account.id })
			.then(() => toast.success(`Removed ${account.label}`))
			.catch((e) => showSaveError(e));

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Payment accounts</PanelTitle>
				<Button variant="outline" size="sm" onClick={() => setEditing({ mode: "new" })}>
					<Plus />
					Add account
				</Button>
			</PanelHeader>
			<PanelBody>
				{accounts.length === 0 ? (
					<p className="text-[0.9375rem] text-muted-foreground">
						Add the bank details clients should pay into. They're printed on your invoices.
					</p>
				) : (
					<RowList>
						{accounts.map((account) => (
							<li key={account.id} className="flex items-center gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 text-[0.9375rem]">
										{account.label}
										{account.isDefault ? <Badge variant="secondary">Default</Badge> : null}
									</div>
									<div className="truncate font-mono text-sm text-muted-foreground">
										{account.details.map((detail) => detail.value).join(" · ") || "No details yet"}
									</div>
								</div>
								<UnitTag>{account.currency}</UnitTag>
								<RowMenu
									onEdit={() => setEditing({ mode: "edit", record: account })}
									onMakeDefault={account.isDefault ? undefined : () => makeDefault(account)}
									onRemove={() => remove(account)}
								/>
							</li>
						))}
					</RowList>
				)}
			</PanelBody>

			<Dialog open={editing.mode !== "closed"} onOpenChange={(open) => !open && close()}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{editing.mode === "edit" ? "Edit account" : "Add a payment account"}
						</DialogTitle>
						<DialogDescription>
							Clients see these details on invoices that use this account.
						</DialogDescription>
					</DialogHeader>
					{editing.mode !== "closed" ? (
						<PaymentAccountForm
							account={editing.mode === "edit" ? editing.record : undefined}
							defaultCurrency={defaultCurrency}
							onSaved={close}
							secondaryAction={
								<DialogClose asChild>
									<Button type="button" variant="ghost">
										Cancel
									</Button>
								</DialogClose>
							}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</Panel>
	);
}

function TaxRatesPanel() {
	const { data: rates = [] } = useTaxRates();
	const update = useUpdateTaxRate();
	const archive = useArchiveTaxRate();
	const [editing, setEditing] = useState<Editing<TaxRate>>({ mode: "closed" });
	const close = () => setEditing({ mode: "closed" });

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Tax rates</PanelTitle>
				<Button variant="outline" size="sm" onClick={() => setEditing({ mode: "new" })}>
					<Plus />
					Add rate
				</Button>
			</PanelHeader>
			<PanelBody>
				{rates.length === 0 ? (
					<p className="text-[0.9375rem] text-muted-foreground">
						Invoices have no tax unless you add a rate here and pick it on a line item.
					</p>
				) : (
					<RowList>
						{rates.map((rate) => (
							<li key={rate.id} className="flex items-center gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 text-[0.9375rem]">
										{rate.name}
										{rate.isDefault ? <Badge variant="secondary">Default</Badge> : null}
									</div>
									{rate.note ? (
										<div className="truncate text-sm text-muted-foreground">{rate.note}</div>
									) : null}
								</div>
								<span className="tabular-nums">{formatRate(rate.rate)}%</span>
								<RowMenu
									onEdit={() => setEditing({ mode: "edit", record: rate })}
									onMakeDefault={
										rate.isDefault
											? undefined
											: () =>
													update
														.mutateAsync({ id: rate.id, data: { ...rate, isDefault: true } })
														.catch((e) => showSaveError(e))
									}
									onRemove={() =>
										archive.mutateAsync({ id: rate.id }).catch((e) => showSaveError(e))
									}
								/>
							</li>
						))}
					</RowList>
				)}
			</PanelBody>

			<Dialog open={editing.mode !== "closed"} onOpenChange={(open) => !open && close()}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editing.mode === "edit" ? "Edit tax rate" : "Add a tax rate"}
						</DialogTitle>
						<DialogDescription>
							Existing invoices keep the rate they were issued with.
						</DialogDescription>
					</DialogHeader>
					{editing.mode !== "closed" ? (
						<TaxRateForm
							taxRate={editing.mode === "edit" ? editing.record : undefined}
							onSaved={close}
							secondaryAction={
								<DialogClose asChild>
									<Button type="button" variant="ghost">
										Cancel
									</Button>
								</DialogClose>
							}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</Panel>
	);
}

function RowMenu({
	onEdit,
	onMakeDefault,
	onRemove,
}: {
	onEdit: () => void;
	onMakeDefault?: () => void;
	onRemove: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label="More actions">
					<Ellipsis />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
				{onMakeDefault ? (
					<DropdownMenuItem onSelect={onMakeDefault}>Make default</DropdownMenuItem>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onSelect={onRemove}>
					Remove
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
