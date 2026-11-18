import type { ComponentType } from "react";
import { ClassicTemplate } from "./classic";
import type { InvoiceTemplateProps } from "./types";

export * from "./types";

/** Templates by the id stored in `branding.template`. */
export const templates: Record<string, ComponentType<InvoiceTemplateProps>> = {
	classic: ClassicTemplate,
};

/** Renders an invoice with the template its branding names, falling back to the default. */
export function InvoiceDocument(props: InvoiceTemplateProps) {
	const Template = templates[props.invoice.branding.template] ?? ClassicTemplate;
	return <Template {...props} />;
}
