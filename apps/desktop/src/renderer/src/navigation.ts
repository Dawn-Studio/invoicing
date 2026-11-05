import { FileText, LayoutDashboard, type LucideIcon, Settings, Users } from "lucide-react";

export type PageId = "dashboard" | "invoices" | "clients" | "settings";

export interface Page {
	id: PageId;
	title: string;
	description: string;
	icon: LucideIcon;
}

export const pages: Record<PageId, Page> = {
	dashboard: {
		id: "dashboard",
		title: "Dashboard",
		description: "Outstanding and paid totals will show up here once you issue invoices.",
		icon: LayoutDashboard,
	},
	invoices: {
		id: "invoices",
		title: "Invoices",
		description: "Create, issue and track invoices. Coming in Phase 3.",
		icon: FileText,
	},
	clients: {
		id: "clients",
		title: "Clients",
		description: "Save client details once and reuse them on every invoice. Coming in Phase 2.",
		icon: Users,
	},
	settings: {
		id: "settings",
		title: "Settings",
		description: "Business profile, payment accounts and branding. Coming in Phase 2.",
		icon: Settings,
	},
};

export const mainNav: PageId[] = ["dashboard", "invoices", "clients"];
