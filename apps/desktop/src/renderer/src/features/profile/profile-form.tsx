import {
	type BusinessProfile,
	formatInvoiceNumber,
	profileInputSchema,
	todayIso,
	validateNumberPattern,
} from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import type { z } from "zod";
import { CurrencyField, NumberField, TextField } from "../../components/form/fields";
import { PageSection } from "../../components/page";
import { showSaveError } from "../../lib/forms";
import { useSaveProfile } from "../../lib/queries";

type ProfileValues = z.input<typeof profileInputSchema>;
type ProfileOutput = z.output<typeof profileInputSchema>;

const emptyAddress = { line1: "", line2: "", city: "", region: "", postalCode: "", country: "" };

function toFormValues(profile: BusinessProfile | null | undefined): ProfileValues {
	if (!profile) {
		return {
			name: "",
			legalName: "",
			email: "",
			phone: "",
			website: "",
			taxId: "",
			address: emptyAddress,
			defaultCurrency: "EUR",
			paymentTermsDays: 14,
			numberPattern: "INV-{YYYY}-{SEQ:4}",
			nextSequence: 1,
		};
	}
	const { id: _, logoFile: __, createdAt: ___, updatedAt: ____, ...values } = profile;
	return values;
}

interface ProfileFormProps {
	profile: BusinessProfile | null | undefined;
	submitLabel: string;
	onSaved?: (profile: BusinessProfile) => void;
	/** Rendered between the business details and the address, e.g. the logo panel. */
	afterBusiness?: ReactNode;
	/** Which panels to show (all by default). Saving always sends the whole profile. */
	sections?: ProfileSection[];
}

export type ProfileSection = "business" | "address" | "invoicing";
const ALL_SECTIONS: ProfileSection[] = ["business", "address", "invoicing"];

/** Business details, address and invoicing defaults, as a column of panels. */
export function ProfileForm({
	profile,
	submitLabel,
	onSaved,
	afterBusiness,
	sections = ALL_SECTIONS,
}: ProfileFormProps) {
	const save = useSaveProfile();
	const form = useForm<ProfileValues, unknown, ProfileOutput>({
		resolver: zodResolver(profileInputSchema),
		defaultValues: toFormValues(profile),
	});
	const { isDirty, isSubmitting } = form.formState;

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const saved = await save.mutateAsync(values);
			form.reset(toFormValues(saved));
			onSaved?.(saved);
		} catch (error) {
			showSaveError(error, form.setError);
		}
	});

	return (
		<FormProvider {...form}>
			<form onSubmit={onSubmit} className="contents" noValidate>
				{sections.includes("business") ? (
					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Your business</PanelTitle>
							</PanelHeader>
							<PanelBody className="grid grid-cols-2 gap-x-4 gap-y-5">
								<TextField<ProfileValues>
									name="name"
									label="Business name"
									placeholder="Dawn Studio"
									className="col-span-2"
									autoFocus={!profile}
								/>
								<TextField<ProfileValues>
									name="legalName"
									label="Legal name"
									description="If it differs, e.g. your registered company name."
									className="col-span-2"
								/>
								<TextField<ProfileValues> name="email" label="Email" type="email" />
								<TextField<ProfileValues> name="phone" label="Phone" type="tel" />
								<TextField<ProfileValues>
									name="website"
									label="Website"
									placeholder="dawn.studio"
								/>
								<TextField<ProfileValues>
									name="taxId"
									label="Tax or VAT number"
									inputClassName="font-mono"
								/>
							</PanelBody>
						</Panel>
					</PageSection>
				) : null}

				{afterBusiness ? <PageSection>{afterBusiness}</PageSection> : null}

				{sections.includes("address") ? (
					<PageSection>
						<AddressPanel title="Address" />
					</PageSection>
				) : null}

				{sections.includes("invoicing") ? (
					<PageSection>
						<InvoicingPanel />
					</PageSection>
				) : null}

				<PageSection className="flex justify-end">
					<Button type="submit" disabled={isSubmitting || (Boolean(profile) && !isDirty)}>
						{isSubmitting ? <Spinner /> : null}
						{submitLabel}
					</Button>
				</PageSection>
			</form>
		</FormProvider>
	);
}

/** Address fields under the `address.*` names; shared by the profile and client forms. */
export function AddressPanel({ title }: { title: string }) {
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{title}</PanelTitle>
			</PanelHeader>
			<PanelBody className="grid grid-cols-6 gap-x-4 gap-y-5">
				<TextField name="address.line1" label="Street address" className="col-span-6" />
				<TextField name="address.line2" label="Apartment, suite, etc." className="col-span-6" />
				<TextField name="address.postalCode" label="Postal code" className="col-span-2" />
				<TextField name="address.city" label="City" className="col-span-4" />
				<TextField name="address.region" label="State or region" className="col-span-3" />
				<TextField name="address.country" label="Country" className="col-span-3" />
			</PanelBody>
		</Panel>
	);
}

function InvoicingPanel() {
	const { control } = useFormContext<ProfileValues>();
	const [pattern, nextSequence] = useWatch({ control, name: ["numberPattern", "nextSequence"] });
	const preview =
		pattern &&
		!validateNumberPattern(pattern) &&
		Number.isInteger(nextSequence) &&
		Number(nextSequence) > 0
			? formatInvoiceNumber(pattern, Number(nextSequence), todayIso())
			: null;

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Invoicing</PanelTitle>
				{preview ? <PanelLabel>Next: {preview}</PanelLabel> : null}
			</PanelHeader>
			<PanelBody className="grid grid-cols-2 gap-x-4 gap-y-5">
				<CurrencyField<ProfileValues> name="defaultCurrency" label="Default currency" />
				<NumberField<ProfileValues>
					name="paymentTermsDays"
					label="Payment terms"
					description="Days until an invoice is due."
					min={0}
				/>
				<TextField<ProfileValues>
					name="numberPattern"
					label="Invoice number format"
					inputClassName="font-mono"
					description={
						<>
							Use <code>{"{YYYY}"}</code>, <code>{"{MM}"}</code> and <code>{"{SEQ:4}"}</code>{" "}
							(number padded to 4 digits).
						</>
					}
				/>
				<NumberField<ProfileValues>
					name="nextSequence"
					label="Next number"
					description="Continue from your previous tool by setting this."
					min={1}
				/>
			</PanelBody>
		</Panel>
	);
}
