import { brandingSchema, type TEMPLATES } from "@dawnstudio/core";
import type { ComponentType } from "react";
import { ClassicTemplate } from "./classic";
import { MinimalTemplate } from "./minimal";
import { ModernTemplate } from "./modern";
import { type InvoiceTemplateProps, PAGE_SIZES, type TemplateProps } from "./types";

export * from "./types";

/**
 * Templates by the id stored in `branding.template`. Issued invoices render with the
 * template named in their snapshot, so templates must keep rendering old snapshots: change
 * a template's look by adding a new id rather than reshaping an existing one.
 */
export const templates: Record<
	(typeof TEMPLATES)[number],
	{ name: string; component: ComponentType<TemplateProps> }
> = {
	classic: { name: "Classic", component: ClassicTemplate },
	modern: { name: "Modern", component: ModernTemplate },
	minimal: { name: "Minimal", component: MinimalTemplate },
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
