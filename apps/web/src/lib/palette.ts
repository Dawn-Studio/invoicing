/** The app's ten colour palettes (packages/ui palettes.css), switchable on the site too. */
export const PALETTES = [
	{ value: "lime", label: "Lime" },
	{ value: "mint", label: "Mint" },
	{ value: "teal", label: "Teal" },
	{ value: "sky", label: "Sky" },
	{ value: "indigo", label: "Indigo" },
	{ value: "violet", label: "Violet" },
	{ value: "rose", label: "Rose" },
	{ value: "coral", label: "Coral" },
	{ value: "amber", label: "Amber" },
	{ value: "mono", label: "Mono" },
] as const;

export type Palette = (typeof PALETTES)[number]["value"];

const EVENT = "palettechange";

export function currentPalette(): Palette {
	if (typeof document === "undefined") return "lime";
	return (document.documentElement.dataset.palette as Palette | undefined) ?? "lime";
}

/** Recolours the whole page and remembers the choice for the next visit. */
export function setPalette(palette: Palette) {
	document.documentElement.dataset.palette = palette;
	try {
		localStorage.setItem("palette", palette);
	} catch {
		// Private mode: it just won't be remembered.
	}
	window.dispatchEvent(new CustomEvent(EVENT, { detail: palette }));
}

export function onPaletteChange(listener: (palette: Palette) => void) {
	const handle = (event: Event) => listener((event as CustomEvent<Palette>).detail);
	window.addEventListener(EVENT, handle);
	return () => window.removeEventListener(EVENT, handle);
}

/** Opens the site's ⌘K menu from anywhere. */
export const openCommand = () => window.dispatchEvent(new Event("open-command"));
