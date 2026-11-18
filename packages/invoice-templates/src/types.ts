import type { InvoiceSnapshot } from "@dawnstudio/core";

export interface InvoiceTemplateProps {
	/** Issued invoices pass their frozen snapshot; drafts pass `previewSnapshot(...)`. */
	invoice: InvoiceSnapshot;
	/** The logo as a URL the page can load (a data URL in the app). */
	logoSrc?: string | null;
	/** Shows placeholders for missing parts instead of leaving them blank. */
	draft?: boolean;
	/** Large diagonal text over the page, e.g. "Void". */
	stamp?: string | null;
}

/** Page size the templates are laid out at (A4 at 96 dpi). */
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
