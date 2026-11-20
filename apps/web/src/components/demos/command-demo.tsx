import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { CornerDownLeft, FileText, Moon, Search, SquarePen, User } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useVisible } from "./shared";

interface Item {
	id: string;
	icon: typeof FileText;
	label: string;
	detail?: string;
	keywords: string;
}

const ITEMS: Item[] = [
	{ id: "new", icon: SquarePen, label: "New invoice", detail: "C", keywords: "new invoice create" },
	{
		id: "c-nordlys",
		icon: User,
		label: "Nordlys AS",
		detail: "Client",
		keywords: "nordlys client",
	},
	{
		id: "i-55",
		icon: FileText,
		label: "INV-2026-0055",
		detail: "Nordlys AS · €4,950",
		keywords: "nordlys invoice 55",
	},
	{
		id: "i-49",
		icon: FileText,
		label: "INV-2026-0049",
		detail: "Nordlys AS · €3,100",
		keywords: "nordlys invoice 49",
	},
	{
		id: "i-56",
		icon: FileText,
		label: "INV-2026-0056",
		detail: "Globex · €4,026",
		keywords: "globex invoice 56",
	},
	{
		id: "dark",
		icon: Moon,
		label: "Dark appearance",
		detail: "Theme",
		keywords: "dark theme appearance",
	},
];

/* Each scene: what gets typed, which result is picked, and what that does. */
const SCENES = [
	{ query: "nord", pick: 1, result: "Opening INV-2026-0055…" },
	{ query: "dark", pick: 0, result: "Switched to dark" },
	{ query: "new", pick: 0, result: "New draft created" },
];

/** ⌘K playing itself: typing, filtering, moving the selection, opening the result. */
export function CommandDemo() {
	const ref = useRef<HTMLDivElement>(null);
	const visible = useVisible(ref);
	const reduced = useReducedMotion();
	const [scene, setScene] = useState(0);
	const [typed, setTyped] = useState(reduced ? (SCENES[0]?.query ?? "") : "");
	const [selected, setSelected] = useState(0);
	const [flash, setFlash] = useState<string | null>(null);

	const results = typed
		? ITEMS.filter((item) => item.keywords.split(" ").some((word) => word.startsWith(typed)))
		: ITEMS.slice(0, 5);

	useEffect(() => {
		const current = SCENES[scene];
		if (reduced || !visible || !current) return;
		const timers: ReturnType<typeof setTimeout>[] = [];
		const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
		setTyped("");
		setSelected(0);
		setFlash(null);
		let t = 700;
		for (let i = 1; i <= current.query.length; i++) {
			at(t, () => setTyped(current.query.slice(0, i)));
			t += 130 + Math.random() * 90;
		}
		t += 450;
		for (let i = 1; i <= current.pick; i++) {
			at(t, () => setSelected(i));
			t += 380;
		}
		at(t + 250, () => setFlash(current.result));
		at(t + 2200, () => setScene((s) => (s + 1) % SCENES.length));
		return () => timers.forEach(clearTimeout);
	}, [scene, visible, reduced]);

	return (
		<div ref={ref} className="relative">
			<div className="overflow-hidden rounded-xl border bg-popover shadow-window">
				<div className="flex h-12 items-center gap-2.5 border-b px-4">
					<Search className="size-4 text-muted-foreground" />
					<span className="text-[0.9375rem]">
						{typed || <span className="text-muted-foreground">Search invoices and clients…</span>}
						<span className="ml-px inline-block h-4 w-px animate-pulse bg-foreground align-middle" />
					</span>
				</div>
				<ul className="min-h-[15.5rem] p-1.5">
					<AnimatePresence initial={false} mode="popLayout">
						{results.map((item, index) => {
							const Icon = item.icon;
							const active = index === selected;
							return (
								<motion.li
									key={item.id}
									layout
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.98 }}
									transition={transitions.snappy}
									className="relative flex h-10 items-center gap-3 rounded-md px-3 text-sm"
								>
									{active ? (
										<motion.span
											layoutId="command-selection"
											transition={transitions.snappy}
											className={cn(
												"absolute inset-0 rounded-md bg-primary/12",
												flash && "bg-primary/25",
											)}
										/>
									) : null}
									<Icon className="relative size-4 text-muted-foreground" />
									<span className="relative flex-1 truncate">{item.label}</span>
									{item.detail ? (
										<span className="relative text-xs text-muted-foreground">{item.detail}</span>
									) : null}
									{active ? (
										<CornerDownLeft className="relative size-3.5 text-muted-foreground" />
									) : null}
								</motion.li>
							);
						})}
					</AnimatePresence>
				</ul>
			</div>
			<AnimatePresence>
				{flash ? (
					<motion.div
						initial={{ opacity: 0, y: 12, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 6 }}
						transition={transitions.snappy}
						className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs whitespace-nowrap shadow-xl"
					>
						<span className="size-1.5 rounded-full bg-primary" />
						{flash}
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
