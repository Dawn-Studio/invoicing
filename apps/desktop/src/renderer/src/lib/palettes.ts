import type { Palette } from "../../../shared/contract";

/** The palettes in Settings → Appearance, in order. Colours live in packages/ui palettes.css. */
export const PALETTE_OPTIONS: { value: Palette; label: string }[] = [
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
];

/** Themes the whole window with a palette. */
export function applyPalette(palette: string) {
	document.documentElement.dataset.palette = palette;
}
