import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, nativeTheme } from "electron";
import { z } from "zod";
import { PALETTES, type Palette, type Theme } from "../shared/contract";

/**
 * App-wide preferences that belong to this computer rather than to a workspace: the theme and
 * where the window was. Kept in `userData/preferences.json`; a missing or broken file means
 * defaults.
 */

const boundsSchema = z.object({
	x: z.number().int(),
	y: z.number().int(),
	width: z.number().int().min(200),
	height: z.number().int().min(200),
	maximized: z.boolean().default(false),
});
export type WindowBounds = z.infer<typeof boundsSchema>;

const preferencesSchema = z.object({
	theme: z.enum(["system", "light", "dark"]).catch("system"),
	palette: z.enum(PALETTES).catch("lime"),
	window: boundsSchema.nullable().catch(null),
});
type Preferences = z.infer<typeof preferencesSchema>;

const file = () => join(app.getPath("userData"), "preferences.json");

let cache: Preferences | null = null;

function read(): Preferences {
	if (cache) return cache;
	try {
		cache = preferencesSchema.parse(JSON.parse(readFileSync(file(), "utf8")));
	} catch {
		cache = { theme: "system", palette: "lime", window: null };
	}
	return cache;
}

function write(patch: Partial<Preferences>) {
	cache = { ...read(), ...patch };
	try {
		mkdirSync(dirname(file()), { recursive: true });
		const partial = `${file()}.partial`;
		writeFileSync(partial, JSON.stringify(cache, null, "\t"));
		renameSync(partial, file());
	} catch (error) {
		// Preferences are a convenience; never fail the action over them.
		console.error("Couldn't save preferences", error);
	}
}

export const getTheme = (): Theme => read().theme;

/** Applies the theme to native UI and the page (`prefers-color-scheme` follows it). */
export function setTheme(theme: Theme) {
	nativeTheme.themeSource = theme;
	if (theme !== read().theme) write({ theme });
}

export const getPalette = (): Palette => read().palette;
export function setPalette(palette: Palette) {
	if (palette !== read().palette) write({ palette });
}

export const getWindowBounds = () => read().window;
export const saveWindowBounds = (window: WindowBounds) => write({ window });
