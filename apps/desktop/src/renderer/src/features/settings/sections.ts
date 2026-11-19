import {
	Building2,
	DatabaseBackup,
	FileText,
	Keyboard,
	Landmark,
	Layers,
	type LucideIcon,
	Mail,
	Paintbrush,
	Percent,
	SunMoon,
} from "lucide-react";

export type SettingsGroup = "workspace" | "app";

export interface SettingsSection {
	id: string;
	label: string;
	description: string;
	icon: LucideIcon;
	group: SettingsGroup;
}

/** Settings pages, in sidebar order. Workspace ones apply to the open workspace only. */
export const SETTINGS_SECTIONS = [
	{
		id: "general",
		label: "General",
		description: "Name this workspace, or remove it.",
		icon: Layers,
		group: "workspace",
	},
	{
		id: "business",
		label: "Business",
		description: "Who you are on every invoice: name, contact details, logo and address.",
		icon: Building2,
		group: "workspace",
	},
	{
		id: "invoices",
		label: "Invoices",
		description: "Numbering, default currency and payment terms, and how PDFs are saved.",
		icon: FileText,
		group: "workspace",
	},
	{
		id: "design",
		label: "Invoice design",
		description: "Template, accent colour and fonts of the invoices you send.",
		icon: Paintbrush,
		group: "workspace",
	},
	{
		id: "payments",
		label: "Payment accounts",
		description: "Where clients pay you. The default is printed on new invoices.",
		icon: Landmark,
		group: "workspace",
	},
	{
		id: "taxes",
		label: "Tax rates",
		description: "Rates you can pick for each invoice line.",
		icon: Percent,
		group: "workspace",
	},
	{
		id: "email",
		label: "Email",
		description: "The messages your mail app opens with when you send an invoice.",
		icon: Mail,
		group: "workspace",
	},
	{
		id: "appearance",
		label: "Appearance",
		description: "Light or dark, and the colour palette. Applies to every workspace.",
		icon: SunMoon,
		group: "app",
	},
	{
		id: "shortcuts",
		label: "Keyboard shortcuts",
		description: "Letters work when you're not typing in a field.",
		icon: Keyboard,
		group: "app",
	},
	{
		id: "data",
		label: "Data & backups",
		description: "Where your data lives, automatic backups, and restoring from one.",
		icon: DatabaseBackup,
		group: "app",
	},
] as const satisfies SettingsSection[];

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
