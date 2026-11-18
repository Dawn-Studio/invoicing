import type { Branding, InvoiceSnapshot } from "@dawnstudio/core";

export interface InvoiceTemplateProps {
	/** Issued invoices pass their frozen snapshot; drafts pass `previewSnapshot(...)`. */
	invoice: InvoiceSnapshot;
	/** The logo as a URL the page can load (a data URL in the app). */
	logoSrc?: string | null;
	/** Shows placeholders for missing parts instead of leaving them blank. */
	draft?: boolean;
	/** Large diagonal text over the page, e.g. "Void". Never printed into PDFs. */
	stamp?: string | null;
}

/** What a template component receives: branding is complete (defaults filled in). */
export interface TemplateProps extends InvoiceTemplateProps {
	branding: Branding;
}

/** Page sizes at 96 dpi, the unit the templates are laid out in. */
export const PAGE_SIZES = {
	a4: { width: 794, height: 1123 },
	letter: { width: 816, height: 1056 },
} as const satisfies Record<Branding["paperSize"], { width: number; height: number }>;

export const FONT_STACKS: Record<Branding["font"], string> = {
	sans: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
	serif: "'Source Serif 4 Variable', ui-serif, Georgia, serif",
	mono: "'Geist Mono Variable', ui-monospace, monospace",
};
