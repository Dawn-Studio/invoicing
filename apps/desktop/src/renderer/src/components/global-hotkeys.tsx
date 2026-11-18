import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { useAppHotkeyList, useAppHotkeys, useHotkey } from "@tanstack/react-hotkeys";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useStartInvoice } from "../features/invoices/use-start-invoice";
import { Shortcut } from "./shortcut";

/** App-wide shortcuts (navigation, new invoice) and the `?` shortcuts sheet. */
export function GlobalHotkeys() {
	const navigate = useNavigate();
	const hotkeys = useAppHotkeys();
	const start = useStartInvoice();
	const [sheetOpen, setSheetOpen] = useState(false);

	useHotkey(hotkeys["invoice.new"], () => void start.run(), { enabled: !start.isPending });
	useHotkey(hotkeys["help.shortcuts"], () => setSheetOpen(true));
	useHotkey(hotkeys["nav.dashboard"], () => navigate("/"));
	useHotkey(hotkeys["nav.invoices"], () => navigate("/invoices"));
	useHotkey(hotkeys["nav.clients"], () => navigate("/clients"));
	useHotkey(hotkeys["nav.items"], () => navigate("/items"));
	useHotkey(hotkeys["nav.settings"], () => navigate("/settings"));

	return <ShortcutsSheet open={sheetOpen} onOpenChange={setSheetOpen} />;
}

function ShortcutsSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const list = useAppHotkeyList();
	// Arrow-key twins of J/K are listed once.
	const items = list.filter(({ appHotkey }) => !appHotkey.id.endsWith("Arrow"));
	const groups = [...new Set(items.map(({ appHotkey }) => appHotkey.meta?.group ?? "Other"))];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
					<DialogDescription>Letters work when you're not typing in a field.</DialogDescription>
				</DialogHeader>
				<div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto">
					{groups.map((group) => (
						<section key={group} className="flex flex-col gap-1">
							<h3 className="text-xs font-medium text-muted-foreground">{group}</h3>
							<ul className="flex flex-col">
								{items
									.filter(({ appHotkey }) => (appHotkey.meta?.group ?? "Other") === group)
									.map(({ appHotkey }) => (
										<li
											key={appHotkey.id}
											className="flex items-center justify-between py-1.5 text-sm"
										>
											<span>{appHotkey.meta?.name}</span>
											<Shortcut hotkey={appHotkey.hotkey} />
										</li>
									))}
							</ul>
						</section>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
