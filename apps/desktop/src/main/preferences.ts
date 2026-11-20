import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, nativeTheme } from "electron";
import { z } from "zod";
import {
	ASSISTANT_PROVIDERS,
	PALETTES,
	type Palette,
	START_SCREENS,
	type StartScreen,
	type Theme,
} from "../shared/contract";

/**
 * App-wide preferences that belong to this computer rather than to a workspace: the theme,
 * where the window was, and the assistant's provider and models. Kept in `userData/preferences.json`; a missing or broken file means
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

const assistantSchema = z.object({
	provider: z.enum(ASSISTANT_PROVIDERS).catch("openrouter"),
	/** The model picked per provider; null = that provider's default. */
	models: z
		.object({
			openrouter: z.string().max(200).nullable().catch(null),
			chatgpt: z.string().max(200).nullable().catch(null),
		})
		.catch({ openrouter: null, chatgpt: null }),
	/** Saw the "what gets sent where" note. */
	acknowledged: z.boolean().catch(false),
	/** Make changes (clients, drafts, items) without asking first. */
	autoApprove: z.boolean().catch(false),
});
export type AssistantPreferences = z.infer<typeof assistantSchema>;
const defaultAssistant: AssistantPreferences = {
	provider: "openrouter",
	models: { openrouter: null, chatgpt: null },
	acknowledged: false,
	autoApprove: false,
};

const preferencesSchema = z.object({
	theme: z.enum(["system", "light", "dark"]).catch("system"),
	palette: z.enum(PALETTES).catch("lime"),
	window: boundsSchema.nullable().catch(null),
	assistant: assistantSchema.catch(defaultAssistant),
	startScreen: z.enum(START_SCREENS).catch("home"),
});
type Preferences = z.infer<typeof preferencesSchema>;

const file = () => join(app.getPath("userData"), "preferences.json");

let cache: Preferences | null = null;

function read(): Preferences {
	if (cache) return cache;
	try {
		cache = preferencesSchema.parse(JSON.parse(readFileSync(file(), "utf8")));
	} catch {
		cache = {
			theme: "system",
			palette: "lime",
			window: null,
			assistant: defaultAssistant,
			startScreen: "home",
		};
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

export const getAssistantPreferences = () => read().assistant;
export function setAssistantPreferences(patch: Partial<AssistantPreferences>) {
	write({ assistant: { ...read().assistant, ...patch } });
}

export const getStartScreen = (): StartScreen => read().startScreen;
export function setStartScreen(startScreen: StartScreen) {
	if (startScreen !== read().startScreen) write({ startScreen });
}
