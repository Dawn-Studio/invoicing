/**
 * Site-wide settings. The domain is a placeholder until it's decided: change it here (the domain also feeds astro.config.ts for canonical URLs and the sitemap).
 */
export const SITE = {
	name: "Invoicing",
	by: "Dawn Studio",
	/** Production URL, no trailing slash. */
	url: "https://invoicing.dawn.studio",
	/** "owner/repo" on GitHub; downloads and the changelog link to its releases. */
	repo: "Dawn-Studio/invoicing",
	title: "Invoicing — invoices that look like your brand",
	description:
		"A local-first desktop app for freelancers and small studios. Branded PDF invoices, clients, payments and reports, stored on your own computer. For macOS, Windows and Linux.",
} as const;

export const releasesUrl = `https://github.com/${SITE.repo}/releases`;
