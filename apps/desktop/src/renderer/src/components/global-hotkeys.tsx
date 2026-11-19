import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useAppHotkeyList, useAppHotkeys, useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { type AppCommand, ROUTES } from "../../../shared/api";
import { useStartInvoice } from "../features/invoices/use-start-invoice";
import { useBackupActions } from "../features/settings/data-panel";
import { UpdateToasts } from "../features/updates/update-notice";
import { CommandPalette } from "./command-palette";
import { Shortcut } from "./shortcut";

/**
 * App-wide shortcuts, the commands the native menu sends, the ⌘K palette and the `?`
 * shortcuts sheet. ⌘K and ⌘, are also menu accelerators; both paths only open things, so
 * it doesn't matter if both fire. ⌘N belongs to the menu alone (it creates a draft).
 */
export function GlobalHotkeys() {
	const navigate = useNavigate();
	const hotkeys = useAppHotkeys();
	const start = useStartInvoice();
	const backups = useBackupActions();
	const queryClient = useQueryClient();
	const [sheetOpen, setSheetOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);

	const startInvoice = () => {
		if (!start.isPending) void start.run();
	};

	useHotkey(hotkeys["invoice.new"], startInvoice, { enabled: !start.isPending });
	useHotkey(hotkeys["help.shortcuts"], () => setSheetOpen(true));
	useHotkey(hotkeys["palette.open"], () => setPaletteOpen(true));
	useHotkey(hotkeys["nav.dashboard"], () => navigate("/"));
	useHotkey(hotkeys["nav.invoices"], () => navigate("/invoices"));
	useHotkey(hotkeys["nav.clients"], () => navigate("/clients"));
	useHotkey(hotkeys["nav.items"], () => navigate("/items"));
	useHotkey(hotkeys["nav.reports"], () => navigate("/reports"));
	useHotkey(hotkeys["nav.settings"], () => navigate("/settings"));

	// The listener is registered once; it always calls the latest handlers.
	const handle = useRef<(command: AppCommand) => void>(() => {});
	handle.current = (command) => {
		switch (command.type) {
			case "navigate":
				return navigate(ROUTES[command.to]);
			case "palette":
				return setPaletteOpen(true);
			case "shortcuts":
				return setSheetOpen(true);
			case "invoice.new":
				return startInvoice();
			case "client.new":
				return navigate("/clients/new");
			case "backup.now":
				return void backups.backUpNow();
			case "backup.export":
				return void backups.exportBackup();
			case "backup.restore":
				return void backups.inspect();
			case "theme.changed":
				return void queryClient.invalidateQueries({ queryKey: ["preferences"] });
			case "update.status":
				return void queryClient.invalidateQueries({ queryKey: ["updates"] });
		}
	};
	useEffect(() => window.api.onCommand((command) => handle.current(command)), []);

	const paletteActions = useMemo(
		() => ({
			newInvoice: () => handle.current({ type: "invoice.new" }),
			backUpNow: () => handle.current({ type: "backup.now" }),
			restore: () => handle.current({ type: "backup.restore" }),
			shortcuts: () => setSheetOpen(true),
		}),
		[],
	);

	return (
		<>
			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={paletteActions} />
			<ShortcutsSheet open={sheetOpen} onOpenChange={setSheetOpen} />
			<UpdateToasts />
			{backups.dialog}
		</>
	);
}

function ShortcutsSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
					<DialogDescription>Letters work when you're not typing in a field.</DialogDescription>
				</DialogHeader>
				<div className="max-h-[60vh] overflow-y-auto">
					<ShortcutList />
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** Every shortcut, grouped; used by the `?` sheet and Settings → Keyboard shortcuts. */
export function ShortcutList({ className }: { className?: string }) {
	const list = useAppHotkeyList();
	// Arrow-key twins of J/K are listed once.
	const items = list.filter(({ appHotkey }) => !appHotkey.id.endsWith("Arrow"));
	const groups = [...new Set(items.map(({ appHotkey }) => appHotkey.meta?.group ?? "Other"))];

	return (
		<div className={cn("flex flex-col gap-5", className)}>
			{groups.map((group) => (
				<section key={group} className="flex flex-col gap-1">
					<h3 className="text-xs font-medium text-muted-foreground">{group}</h3>
					<ul className="flex flex-col">
						{items
							.filter(({ appHotkey }) => (appHotkey.meta?.group ?? "Other") === group)
							.map(({ appHotkey }) => (
								<li key={appHotkey.id} className="flex items-center justify-between py-1.5 text-sm">
									<span>{appHotkey.meta?.name}</span>
									<Shortcut hotkey={appHotkey.hotkey} />
								</li>
							))}
					</ul>
				</section>
			))}
		</div>
	);
}
