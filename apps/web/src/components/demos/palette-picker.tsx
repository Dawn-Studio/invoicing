import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
	currentPalette,
	onPaletteChange,
	PALETTES,
	type Palette,
	setPalette,
} from "../../lib/palette";
import { currentTheme, onThemeChange, setTheme, THEMES, type Theme } from "../../lib/theme";

const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/**
 * The app's ten palettes and light/dark. Picking one recolours this whole page (the site uses the
 * app's own colour tokens), and is remembered for your next visit.
 */
export function PalettePicker() {
	const [palette, setCurrent] = useState<Palette>("lime");
	const [theme, setCurrentTheme] = useState<Theme>("system");
	const [changed, setChanged] = useState(false);

	useEffect(() => {
		setCurrent(currentPalette());
		setCurrentTheme(currentTheme());
		const stopPalette = onPaletteChange(setCurrent);
		const stopTheme = onThemeChange(setCurrentTheme);
		return () => {
			stopPalette();
			stopTheme();
		};
	}, []);

	const choose = (value: Palette) => {
		setPalette(value);
		setChanged(true);
	};

	return (
		<div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div className="flex flex-col gap-6">
				<div className="grid grid-cols-5 gap-3">
					{PALETTES.map(({ value, label }) => (
						<button
							key={value}
							type="button"
							data-palette={value}
							aria-pressed={palette === value}
							onClick={() => choose(value)}
							className="group flex flex-col items-center gap-2 outline-none"
						>
							<span className="relative flex aspect-square w-full items-center justify-center rounded-2xl border bg-card transition-transform group-hover:-translate-y-0.5 group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-ring">
								{palette === value ? (
									<motion.span
										layoutId="palette-ring"
										transition={transitions.snappy}
										className="absolute -inset-[3px] rounded-[18px] border-2 border-primary"
									/>
								) : null}
								<span className="size-1/2 rounded-full bg-primary shadow-[0_0_24px_-4px] shadow-primary/70 transition-transform group-hover:scale-110" />
							</span>
							<span
								className={cn(
									"text-xs text-muted-foreground transition-colors",
									palette === value && "font-medium text-foreground",
								)}
							>
								{label}
							</span>
						</button>
					))}
				</div>
				<div className="grid grid-cols-3 gap-1 self-start rounded-lg bg-muted p-1 text-xs">
					{THEMES.map(({ value, label }) => {
						const Icon = THEME_ICONS[value];
						return (
							<button
								key={value}
								type="button"
								aria-pressed={theme === value}
								onClick={() => {
									setTheme(value);
									setChanged(true);
								}}
								className={cn(
									"relative flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
									theme === value
										? "text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{theme === value ? (
									<motion.span
										layoutId="theme-segment"
										transition={transitions.snappy}
										className="absolute inset-0 rounded-md bg-background shadow-sm"
									/>
								) : null}
								<Icon className="relative size-3.5" />
								<span className="relative">{value === "system" ? "System" : label}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* A slice of the app in the chosen palette. */}
			<div className="relative">
				<div className="flex overflow-hidden rounded-xl border bg-background shadow-window">
					<div className="flex w-36 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 text-xs">
						<div className="mb-2 flex items-center gap-2 font-medium">
							<span className="flex size-5 items-center justify-center rounded bg-primary text-[0.625rem] font-bold text-primary-foreground">
								D
							</span>
							Dawn Studio
						</div>
						{["Dashboard", "Invoices", "Clients", "Reports"].map((item) => (
							<span
								key={item}
								className={cn(
									"rounded-md px-2 py-1.5 text-muted-foreground",
									item === "Invoices" && "bg-primary/15 font-medium text-foreground",
								)}
							>
								{item}
							</span>
						))}
					</div>
					<div className="flex flex-1 flex-col gap-3 p-4">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Invoices</span>
							<span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
								+ New invoice
							</span>
						</div>
						{[72, 54, 88].map((width, index) => (
							<div
								key={width}
								className="flex items-center gap-2 rounded-md border bg-card px-3 py-2.5"
							>
								<span
									className={cn(
										"size-2 rounded-full",
										index === 1 ? "bg-destructive" : "bg-primary",
									)}
								/>
								<span
									className="h-1.5 rounded-full bg-foreground/20"
									style={{ width: `${width / 2}%` }}
								/>
								<span className="ml-auto h-1.5 w-10 rounded-full bg-foreground/30" />
							</div>
						))}
						<div className="mt-1 flex h-16 items-end gap-1.5">
							{[30, 45, 38, 60, 52, 75, 68, 90].map((height) => (
								<span
									key={height}
									className="flex-1 rounded-t-sm bg-primary"
									style={{ height: `${height}%`, opacity: 0.35 + (height / 90) * 0.65 }}
								/>
							))}
						</div>
					</div>
				</div>
				<AnimatePresence>
					{changed ? (
						<motion.p
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							className="absolute -bottom-9 left-0 text-sm text-muted-foreground"
						>
							Notice the whole page changed? The app does exactly that.
						</motion.p>
					) : null}
				</AnimatePresence>
			</div>
		</div>
	);
}
