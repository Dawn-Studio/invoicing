import { brandingSchema, type TEMPLATES } from "@dawnstudio/core";
import type { ComponentType } from "react";
import { BannerTemplate } from "./banner";
import { BoldTemplate } from "./bold";
import { BoxedTemplate } from "./boxed";
import { ClassicTemplate } from "./classic";
import { CompactTemplate } from "./compact";
import { CorporateTemplate } from "./corporate";
import { EditorialTemplate } from "./editorial";
import { GeometricTemplate } from "./geometric";
import { LedgerTemplate } from "./ledger";
import { LetterheadTemplate } from "./letterhead";
import { MinimalTemplate } from "./minimal";
import { ModernTemplate } from "./modern";
import { ReceiptTemplate } from "./receipt";
import { SidebarTemplate } from "./sidebar";
import { StatementTemplate } from "./statement";
import { type InvoiceTemplateProps, PAGE_SIZES, type TemplateProps } from "./types";

export * from "./types";

/**
 * Templates by the id stored in `branding.template`. Issued invoices render with the
 * template named in their snapshot, so templates must keep rendering old snapshots: change
 * a template's look by adding a new id rather than reshaping an existing one.
 */
export const templates: Record<
	(typeof TEMPLATES)[number],
	{ name: string; description: string; component: ComponentType<TemplateProps> }
> = {
	classic: {
		name: "Classic",
		description: "Logo and title on top, both parties side by side.",
		component: ClassicTemplate,
	},
	modern: {
		name: "Modern",
		description: "An accent bar and the amount due in a coloured block.",
		component: ModernTemplate,
	},
	minimal: {
		name: "Minimal",
		description: "Quiet and typographic, one thin accent rule.",
		component: MinimalTemplate,
	},
	statement: {
		name: "Statement",
		description: "Leads with how much, by when, and where to pay.",
		component: StatementTemplate,
	},
	sidebar: {
		name: "Sidebar",
		description: "A coloured column with dates, total and payment details.",
		component: SidebarTemplate,
	},
	banner: {
		name: "Banner",
		description: "A dark header band with the essentials in white.",
		component: BannerTemplate,
	},
	bold: {
		name: "Bold",
		description: "A huge title and an oversized total.",
		component: BoldTemplate,
	},
	letterhead: {
		name: "Letterhead",
		description: "Formal, centred letterhead with a double rule.",
		component: LetterheadTemplate,
	},
	corporate: {
		name: "Corporate",
		description: "Company details, a details table, a coloured table header.",
		component: CorporateTemplate,
	},
	ledger: {
		name: "Ledger",
		description: "Fully ruled tables, made for accountants.",
		component: LedgerTemplate,
	},
	editorial: {
		name: "Editorial",
		description: "A large light number, sections labelled in the margin.",
		component: EditorialTemplate,
	},
	boxed: {
		name: "Boxed",
		description: "Each part in its own soft card.",
		component: BoxedTemplate,
	},
	geometric: {
		name: "Geometric",
		description: "Playful accent circles and rounded shapes.",
		component: GeometricTemplate,
	},
	compact: {
		name: "Compact",
		description: "Small type and tight rows for long invoices.",
		component: CompactTemplate,
	},
	receipt: {
		name: "Receipt",
		description: "A narrow centred column with dashed rules.",
		component: ReceiptTemplate,
	},
};

/** Fills in branding defaults (snapshots from older versions lack newer fields). */
export const brandingOf = (invoice: InvoiceTemplateProps["invoice"]) =>
	brandingSchema.parse(invoice.branding ?? {});

export const pageSizeOf = (invoice: InvoiceTemplateProps["invoice"]) =>
	PAGE_SIZES[brandingOf(invoice).paperSize];

/** Renders an invoice with the template its branding names, falling back to the default. */
export function InvoiceDocument(props: InvoiceTemplateProps) {
	const branding = brandingOf(props.invoice);
	const Template =
		templates[branding.template as keyof typeof templates]?.component ?? ClassicTemplate;
	return <Template {...props} branding={branding} />;
}
