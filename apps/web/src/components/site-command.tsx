import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@dawnstudio/ui/components/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import {
	ArrowUpRight,
	Check,
	Download,
	FileClock,
	GitBranch,
	LayoutGrid,
	Monitor,
	MonitorPlay,
	Moon,
	Sparkles,
	Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	currentPalette,
	onPaletteChange,
	PALETTES,
	type Palette,
	setPalette,
} from "../lib/palette";
import { currentTheme, onThemeChange, setTheme, THEMES, type Theme } from "../lib/theme";
import { SITE } from "../site";

const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/**
 * ⌘K on the website, like in the app: jump to a section or page, or try a theme or palette.
 * Opens with ⌘K / Ctrl+K, or any element with `data-open-command`.
 */
export function SiteCommand() {
	const [open, setOpen] = useState(false);
	const [palette, setCurrent] = useState<Palette>("lime");
	const [theme, setCurrentTheme] = useState<Theme>("system");

	useEffect(() => {
		setCurrent(currentPalette());
		setCurrentTheme(currentTheme());
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}
		};
		const onClick = (event: MouseEvent) => {
			if ((event.target as Element | null)?.closest("[data-open-command]")) setOpen(true);
		};
		const onOpen = () => setOpen(true);
		window.addEventListener("keydown", onKey);
		document.addEventListener("click", onClick);
		window.addEventListener("open-command", onOpen);
		const stop = onPaletteChange(setCurrent);
		const stopTheme = onThemeChange(setCurrentTheme);
		return () => {
			stopTheme();
			window.removeEventListener("keydown", onKey);
			document.removeEventListener("click", onClick);
			window.removeEventListener("open-command", onOpen);
			stop();
		};
	}, []);

	const go = (href: string) => () => {
		setOpen(false);
		window.location.href = href;
	};

	const pages = [
		{ label: "Features", href: "/#features", icon: Sparkles },
		{ label: "Take the tour", href: "/#tour", icon: MonitorPlay },
		{ label: "Make it yours", href: "/#palettes", icon: LayoutGrid },
		{ label: "Download", href: "/download", icon: Download },
		{ label: "Changelog", href: "/changelog", icon: FileClock },
		{ label: "Source on GitHub", href: `https://github.com/${SITE.repo}`, icon: GitBranch },
	];

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				showCloseButton={false}
				className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
			>
				<DialogTitle className="sr-only">Command menu</DialogTitle>
				<DialogDescription className="sr-only">
					Jump around the site or try a theme or palette
				</DialogDescription>
				<Command loop className="rounded-none">
					<CommandInput placeholder="Type a command or search…" className="h-12 text-[0.9375rem]" />
					<CommandList className="max-h-[min(420px,60vh)] p-1 [&_[data-slot=command-item]]:h-9 [&_[data-slot=command-item]]:px-2.5 [&_[data-slot=command-item][data-selected=true]]:bg-primary/12">
						<CommandEmpty>Nothing here. Try “dark”, “download” or “mint”.</CommandEmpty>
						<CommandGroup heading="Go to">
							{pages.map(({ label, href, icon: Icon }) => (
								<CommandItem key={href} value={label} onSelect={go(href)}>
									<Icon />
									<span className="flex-1">{label}</span>
									{href.startsWith("http") ? <ArrowUpRight className="opacity-60" /> : null}
								</CommandItem>
							))}
						</CommandGroup>
						<CommandGroup heading="Appearance">
							{THEMES.map(({ value, label }) => {
								const Icon = THEME_ICONS[value];
								return (
									<CommandItem
										key={value}
										value={`${label} ${value} theme appearance mode`}
										onSelect={() => setTheme(value)}
									>
										<Icon />
										<span className="flex-1">{label}</span>
										{theme === value ? <Check className="text-brand-ink" /> : null}
									</CommandItem>
								);
							})}
						</CommandGroup>
						<CommandGroup heading="Colour palette">
							{PALETTES.map(({ value, label }) => (
								<CommandItem
									key={value}
									value={`${label} palette colour color theme`}
									onSelect={() => setPalette(value)}
								>
									<span data-palette={value} className="flex size-4 items-center justify-center">
										<span className="size-3 rounded-full bg-primary" />
									</span>
									<span className="flex-1">{label}</span>
									{palette === value ? <Check className="text-brand-ink" /> : null}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
