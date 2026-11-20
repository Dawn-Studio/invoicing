import {
	addDays,
	type Branding,
	type BusinessProfile,
	type Client,
	FONTS,
	formatInvoiceNumber,
	type PaymentAccount,
	previewSnapshot,
	TEMPLATES,
	todayIso,
} from "@dawnstudio/core";
import { templates } from "@dawnstudio/invoice-templates";
import { Button } from "@dawnstudio/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { Textarea } from "@dawnstudio/ui/components/textarea";
import { cn } from "@dawnstudio/ui/lib/utils";
import { Check } from "lucide-react";
import { type ReactNode, useDeferredValue, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useLogo, usePaymentAccounts, useRpcMutation } from "../../lib/queries";
import { InvoicePreview } from "../invoices/invoice-preview";

const SWATCHES = [
	"#4f46e5",
	"#0f172a",
	"#0e7490",
	"#047857",
	"#b45309",
	"#be123c",
	"#7c3aed",
	"#525252",
];
const FONT_LABELS: Record<Branding["font"], string> = {
	sans: "Sans",
	serif: "Serif",
	mono: "Mono",
};

/** A made-up client and two lines, so the template cards show a realistic invoice. */
function sampleInvoice(
	profile: BusinessProfile,
	branding: Branding,
	account: PaymentAccount | null,
) {
	const today = todayIso();
	const client: Client = {
		id: "sample",
		name: "Northwind Studio",
		contactName: "Alex Morgan",
		email: "accounts@northwind.example",
		phone: "",
		taxId: "",
		address: {
			line1: "12 Harbour Street",
			line2: "",
			city: "Bristol",
			region: "",
			postalCode: "BS1 4XE",
			country: "United Kingdom",
		},
		currency: null,
		paymentTermsDays: null,
		notes: "",
		contacts: [],
		archivedAt: null,
		createdAt: 0,
		updatedAt: 0,
	};
	return previewSnapshot({
		number: formatInvoiceNumber(profile.numberPattern, profile.nextSequence, today),
		issueDate: today,
		dueDate: addDays(today, profile.paymentTermsDays),
		currency: profile.defaultCurrency,
		discount: null,
		notes: "Thank you for your business.",
		terms: "",
		items: [
			{ description: "Design work", unit: "h", quantity: 24_000, unitPrice: 9_500, taxRate: 0 },
			{ description: "Website hosting", unit: "mo", quantity: 1_000, unitPrice: 4_000, taxRate: 0 },
		],
		profile: { ...profile, branding },
		client,
		paymentAccount: account,
		taxNotes: [],
	});
}

/** Settings: how invoices look. Applies to drafts and new invoices; issued ones keep theirs. */
export function BrandingPanel({ profile }: { profile: BusinessProfile }) {
	const [branding, setBranding] = useState<Branding>(profile.branding);
	const { data: logo } = useLogo();
	const { data: accounts = [] } = usePaymentAccounts();
	const save = useRpcMutation("profile.saveBranding", ["profile"]);
	const set = (patch: Partial<Branding>) => setBranding((current) => ({ ...current, ...patch }));
	const dirty = JSON.stringify(branding) !== JSON.stringify(profile.branding);
	const validColor = /^#[0-9a-fA-F]{6}$/.test(branding.accentColor);
	const account = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;

	// Fifteen live previews: let them catch up after typing or dragging the colour picker.
	const shown = useDeferredValue(branding);
	const samples = useMemo(
		() =>
			TEMPLATES.map((template) => ({
				template,
				invoice: sampleInvoice(
					profile,
					{
						...shown,
						template,
						accentColor: /^#[0-9a-fA-F]{6}$/.test(shown.accentColor)
							? shown.accentColor
							: profile.branding.accentColor,
					},
					account,
				),
			})),
		[profile, shown, account],
	);

	const onSave = async () => {
		try {
			await save.mutateAsync(branding);
			toast.success("Branding saved", {
				description: "Drafts and new invoices use it. Issued invoices keep their look.",
			});
		} catch (error) {
			showSaveError(error);
		}
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Branding</PanelTitle>
				<PanelLabel>{dirty ? "Unsaved" : "Printed on invoices"}</PanelLabel>
			</PanelHeader>
			<PanelBody className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<div className="flex items-baseline justify-between gap-4">
						<span className="text-sm font-medium">Template</span>
						<span className="text-sm text-muted-foreground">{templates[branding.template as keyof typeof templates]?.description}</span>
					</div>
					<div className="grid grid-cols-3 gap-x-4 gap-y-5">
						{samples.map(({ template, invoice }) => {
							const selected = branding.template === template;
							return (
								<button
									key={template}
									type="button"
									onClick={() => set({ template })}
									aria-pressed={selected}
									className="group flex flex-col gap-2 text-left outline-none"
								>
									<div
										className={cn(
											"rounded-lg p-1 ring-1 ring-border transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring",
											selected && "ring-2 ring-brand-ink",
										)}
									>
										<InvoicePreview
											invoice={invoice}
											logoSrc={logo}
											className="pointer-events-none"
										/>
									</div>
									<span className="flex items-center gap-1.5 text-sm" title={templates[template].description}>
										{selected ? <Check className="size-3.5 text-brand-ink" /> : null}
										{templates[template].name}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				<Labeled label="Accent colour" description="Titles, totals and highlights.">
					{(id) => (
						<div className="flex flex-wrap items-center gap-2">
							{SWATCHES.map((color) => (
								<button
									key={color}
									type="button"
									aria-label={color}
									onClick={() => set({ accentColor: color })}
									className={cn(
										"size-7 rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring",
										branding.accentColor.toLowerCase() === color && "ring-2 ring-foreground",
									)}
									style={{ backgroundColor: color }}
								/>
							))}
							<label className="relative ml-1 flex items-center gap-2">
								<input
									type="color"
									value={validColor ? branding.accentColor : "#000000"}
									onChange={(event) => set({ accentColor: event.target.value })}
									className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
									aria-label="Custom colour"
								/>
							</label>
							<Input
								id={id}
								value={branding.accentColor}
								onChange={(event) => set({ accentColor: event.target.value.trim() })}
								aria-invalid={!validColor}
								className="w-28 font-mono"
								maxLength={7}
							/>
						</div>
					)}
				</Labeled>

				<div className="grid grid-cols-3 gap-x-4 gap-y-5">
					<Labeled label="Font">
						{() => (
							<Segmented
								value={branding.font}
								options={FONTS.map((font) => ({ value: font, label: FONT_LABELS[font] }))}
								onChange={(font) => set({ font })}
							/>
						)}
					</Labeled>
					<Labeled label="Logo">
						{() => (
							<Segmented
								value={branding.logoPosition}
								options={[
									{ value: "left", label: "Left" },
									{ value: "right", label: "Right" },
								]}
								onChange={(logoPosition) => set({ logoPosition })}
							/>
						)}
					</Labeled>
					<Labeled label="Paper">
						{() => (
							<Segmented
								value={branding.paperSize}
								options={[
									{ value: "a4", label: "A4" },
									{ value: "letter", label: "Letter" },
								]}
								onChange={(paperSize) => set({ paperSize })}
							/>
						)}
					</Labeled>
				</div>

				<Labeled
					label="Footer"
					description="Small print at the bottom of every invoice, e.g. registration number or bank notes."
				>
					{(id) => (
						<Textarea
							id={id}
							value={branding.footer}
							onChange={(event) => set({ footer: event.target.value })}
							placeholder="Registered in Estonia, no. 16123456"
							maxLength={500}
							rows={2}
						/>
					)}
				</Labeled>

				<div className="flex justify-end gap-2">
					{dirty ? (
						<Button type="button" variant="ghost" onClick={() => setBranding(profile.branding)}>
							Reset
						</Button>
					) : null}
					<Button type="button" onClick={onSave} disabled={!dirty || !validColor || save.isPending}>
						{save.isPending ? <Spinner /> : null}
						Save branding
					</Button>
				</div>
			</PanelBody>
		</Panel>
	);
}

function Segmented<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) {
	return (
		<div className="flex rounded-md border p-0.5">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={cn(
						"h-8 flex-1 rounded-[5px] px-2 text-sm text-muted-foreground transition-colors",
						value === option.value && "bg-accent font-medium text-foreground",
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function Labeled({
	label,
	description,
	children,
}: {
	label: string;
	description?: ReactNode;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{children(id)}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}
