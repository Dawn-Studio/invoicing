import { defineAppHotkeys } from "@tanstack/react-hotkeys";

/**
 * Every keyboard shortcut in the app, declared once so the shortcuts sheet (`?`) can list
 * them all. Components register the ones they handle with `useHotkey(appHotkeys[id], …)`.
 * Single-key shortcuts don't fire while typing in a field (the library's default).
 */
export const appHotkeys = defineAppHotkeys({
	"invoice.new": { hotkey: "C", meta: { name: "New invoice", group: "General" } },
	"palette.open": { hotkey: "Mod+K", meta: { name: "Command palette", group: "General" } },
	"assistant.toggle": { hotkey: "Mod+J", meta: { name: "Assistant", group: "General" } },
	"help.shortcuts": { hotkey: "?", meta: { name: "Keyboard shortcuts", group: "General" } },
	"nav.dashboard": { hotkey: ["G", "D"], meta: { name: "Go to Dashboard", group: "Navigation" } },
	"nav.invoices": { hotkey: ["G", "I"], meta: { name: "Go to Invoices", group: "Navigation" } },
	"nav.clients": { hotkey: ["G", "C"], meta: { name: "Go to Clients", group: "Navigation" } },
	"nav.items": { hotkey: ["G", "T"], meta: { name: "Go to Items", group: "Navigation" } },
	"nav.reports": { hotkey: ["G", "R"], meta: { name: "Go to Reports", group: "Navigation" } },
	"nav.settings": { hotkey: "Mod+,", meta: { name: "Settings", group: "Navigation" } },
	"settings.close": { hotkey: "Escape", meta: { name: "Leave settings", group: "Navigation" } },
	"list.next": { hotkey: "J", meta: { name: "Next invoice", group: "Invoice list" } },
	"list.prev": { hotkey: "K", meta: { name: "Previous invoice", group: "Invoice list" } },
	"list.nextArrow": { hotkey: "ArrowDown", meta: { name: "Next invoice", group: "Invoice list" } },
	"list.prevArrow": {
		hotkey: "ArrowUp",
		meta: { name: "Previous invoice", group: "Invoice list" },
	},
	"list.open": { hotkey: "Enter", meta: { name: "Open invoice", group: "Invoice list" } },
	"list.toggle": { hotkey: "X", meta: { name: "Select invoice", group: "Invoice list" } },
	"list.selectAll": { hotkey: "Mod+A", meta: { name: "Select all", group: "Invoice list" } },
	"list.clear": { hotkey: "Escape", meta: { name: "Clear selection", group: "Invoice list" } },
	"list.search": { hotkey: "/", meta: { name: "Search", group: "Invoice list" } },
	"list.markPaid": { hotkey: "P", meta: { name: "Mark paid today", group: "Invoice list" } },
	"list.export": { hotkey: "E", meta: { name: "Export PDFs", group: "Invoice list" } },
	"editor.save": { hotkey: "Mod+S", meta: { name: "Save now", group: "Invoice" } },
	"editor.addLine": { hotkey: "Mod+L", meta: { name: "Add a line", group: "Invoice" } },
	"editor.issue": { hotkey: "Mod+Enter", meta: { name: "Issue draft", group: "Invoice" } },
	"invoice.payment": { hotkey: "P", meta: { name: "Record payment", group: "Invoice" } },
	"invoice.send": { hotkey: "S", meta: { name: "Send", group: "Invoice" } },
	"invoice.print": { hotkey: "Mod+P", meta: { name: "Print", group: "Invoice" } },
	"invoice.exportPdf": { hotkey: "Mod+E", meta: { name: "Export PDF", group: "Invoice" } },
	"invoice.duplicate": { hotkey: "Mod+D", meta: { name: "Duplicate", group: "Invoice" } },
});

declare module "@tanstack/react-hotkeys" {
	interface Register {
		appHotkeys: typeof appHotkeys;
	}
}
