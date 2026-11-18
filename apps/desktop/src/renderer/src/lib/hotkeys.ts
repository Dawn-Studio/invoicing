import { defineAppHotkeys } from "@tanstack/react-hotkeys";

/**
 * Every keyboard shortcut in the app, declared once so the shortcuts sheet (`?`) can list
 * them all. Components register the ones they handle with `useHotkey(appHotkeys[id], …)`.
 * Single-key shortcuts don't fire while typing in a field (the library's default).
 */
export const appHotkeys = defineAppHotkeys({
	"invoice.new": { hotkey: "C", meta: { name: "New invoice", group: "General" } },
	"help.shortcuts": { hotkey: "?", meta: { name: "Keyboard shortcuts", group: "General" } },
	"nav.dashboard": { hotkey: ["G", "D"], meta: { name: "Go to Dashboard", group: "Navigation" } },
	"nav.invoices": { hotkey: ["G", "I"], meta: { name: "Go to Invoices", group: "Navigation" } },
	"nav.clients": { hotkey: ["G", "C"], meta: { name: "Go to Clients", group: "Navigation" } },
	"nav.items": { hotkey: ["G", "T"], meta: { name: "Go to Items", group: "Navigation" } },
	"nav.settings": { hotkey: "Mod+,", meta: { name: "Settings", group: "Navigation" } },
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
});

declare module "@tanstack/react-hotkeys" {
	interface Register {
		appHotkeys: typeof appHotkeys;
	}
}
