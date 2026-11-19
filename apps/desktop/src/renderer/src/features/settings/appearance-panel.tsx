import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { cn } from "@dawnstudio/ui/lib/utils";
import type { Palette, Theme } from "../../../../shared/contract";
import { showSaveError } from "../../lib/forms";
import { applyPalette, PALETTE_OPTIONS } from "../../lib/palettes";
import { usePalette, useSetPalette, useSetTheme, useTheme } from "../../lib/queries";

const OPTIONS: { value: Theme; label: string }[] = [
	{ value: "system", label: "Match system" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

/** A tiny window in the given palette: sidebar, title bar, a couple of rows, a lime accent. */
function Thumbnail({ tone }: { tone: "light" | "dark" }) {
	const dark = tone === "dark";
	return (
		<span
			className={cn("flex h-full w-full overflow-hidden", dark ? "bg-[#0e100c]" : "bg-[#ffffff]")}
		>
			<span
				className={cn("flex w-[30%] flex-col gap-1 p-1.5", dark ? "bg-[#1a1d17]" : "bg-[#f1f2ee]")}
			>
				<span className="h-1 w-3/4 rounded-full bg-primary" />
				<span className={cn("h-1 w-full rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
				<span className={cn("h-1 w-2/3 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
			</span>
			<span className="flex flex-1 flex-col gap-1.5 p-2">
				<span className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-white/30" : "bg-black/25")} />
				<span
					className={cn("h-5 rounded-[3px] border", dark ? "border-white/10" : "border-black/10")}
				/>
				<span
					className={cn("h-5 rounded-[3px] border", dark ? "border-white/10" : "border-black/10")}
				/>
			</span>
		</span>
	);
}

/** Light, dark, or following the OS: applies to every workspace on this computer. */
export function ThemePanel() {
	const { data: theme } = useTheme();
	const setTheme = useSetTheme();

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Theme</PanelTitle>
			</PanelHeader>
			<PanelBody>
				<fieldset className="grid grid-cols-3 gap-3">
					<legend className="sr-only">Theme</legend>
					{OPTIONS.map(({ value, label }) => {
						const selected = theme === value;
						return (
							<button
								key={value}
								type="button"
								aria-pressed={selected}
								onClick={() =>
									setTheme.mutate({ theme: value }, { onError: (error) => showSaveError(error) })
								}
								className="group flex flex-col gap-2 text-left outline-none"
							>
								<span
									className={cn(
										"relative aspect-[16/10] overflow-hidden rounded-lg border shadow-xs ring-offset-2 ring-offset-panel transition-shadow group-hover:border-foreground/25 group-focus-visible:ring-2 group-focus-visible:ring-ring",
										selected && "border-transparent ring-2 ring-brand-ink",
									)}
								>
									{value === "system" ? (
										<>
											<Thumbnail tone="light" />
											{/* The right half in dark: "whichever the OS uses". */}
											<span className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
												<span className="absolute inset-y-0 right-0 flex w-[200%]">
													<Thumbnail tone="dark" />
												</span>
											</span>
										</>
									) : (
										<Thumbnail tone={value} />
									)}
								</span>
								<span
									className={cn(
										"text-sm text-muted-foreground",
										selected && "font-medium text-foreground",
									)}
								>
									{label}
								</span>
							</button>
						);
					})}
				</fieldset>
			</PanelBody>
		</Panel>
	);
}

/** The ten colour palettes, each previewed in its own colours in the current light/dark mode. */
export function PalettePanel() {
	const { data: palette = window.api.palette } = usePalette();
	const setPalette = useSetPalette();

	const choose = (value: Palette) => {
		applyPalette(value);
		setPalette.mutate(
			{ palette: value },
			{
				onError: (error) => {
					applyPalette(palette);
					showSaveError(error);
				},
			},
		);
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Colour palette</PanelTitle>
				<PanelLabel>{PALETTE_OPTIONS.find((p) => p.value === palette)?.label}</PanelLabel>
			</PanelHeader>
			<PanelBody>
				<fieldset className="grid grid-cols-5 gap-x-3 gap-y-4">
					<legend className="sr-only">Colour palette</legend>
					{PALETTE_OPTIONS.map(({ value, label }) => {
						const selected = palette === value;
						return (
							<button
								key={value}
								type="button"
								data-palette={value}
								aria-pressed={selected}
								onClick={() => choose(value)}
								className="group flex flex-col gap-2 text-left outline-none"
							>
								<span
									className={cn(
										"flex aspect-[4/3] overflow-hidden rounded-lg border bg-background text-foreground shadow-xs ring-offset-2 ring-offset-panel transition-[box-shadow,border-color] group-hover:border-foreground/25 group-focus-visible:ring-2 group-focus-visible:ring-ring",
										selected && "border-transparent ring-2 ring-brand-ink",
									)}
								>
									<span className="flex w-[34%] flex-col gap-1 bg-sidebar p-1.5">
										<span className="h-1.5 w-3/4 rounded-full bg-primary" />
										<span className="h-1 w-full rounded-full bg-foreground/15" />
										<span className="h-1 w-2/3 rounded-full bg-foreground/15" />
									</span>
									<span className="flex flex-1 flex-col gap-1.5 p-1.5">
										<span className="h-1.5 w-1/2 rounded-full bg-foreground/30" />
										<span className="h-3.5 rounded-[3px] border bg-panel" />
										<span className="mt-auto h-2.5 w-1/2 self-end rounded-[3px] bg-primary" />
									</span>
								</span>
								<span
									className={cn(
										"flex items-center gap-1.5 text-sm text-muted-foreground",
										selected && "font-medium text-foreground",
									)}
								>
									<span className="size-2 rounded-full bg-primary" />
									{label}
								</span>
							</button>
						);
					})}
				</fieldset>
			</PanelBody>
		</Panel>
	);
}
