/** Light, dark, or whatever the visitor's system uses (the default), like the app. */
export const THEMES = [
	{ value: "system", label: "Match system" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
] as const;

export type Theme = (typeof THEMES)[number]["value"];

const KEY = "theme";
const EVENT = "themechange";
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

export function currentTheme(): Theme {
	if (typeof window === "undefined") return "system";
	try {
		const stored = localStorage.getItem(KEY);
		if (stored === "light" || stored === "dark") return stored;
	} catch {
		// Private mode: fall back to the system.
	}
	return "system";
}

/** Whether the page is dark right now. */
export function isDark() {
	return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function apply(theme: Theme) {
	const dark = theme === "dark" || (theme === "system" && query().matches);
	document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme) {
	try {
		if (theme === "system") localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, theme);
	} catch {
		// It just won't be remembered.
	}
	apply(theme);
	window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }));
}

/** Calls back with the chosen theme whenever it, or the system's (when following it), changes. */
export function onThemeChange(listener: (theme: Theme) => void) {
	const handle = () => listener(currentTheme());
	const system = () => {
		if (currentTheme() !== "system") return;
		apply("system");
		handle();
	};
	const media = query();
	window.addEventListener(EVENT, handle);
	media.addEventListener("change", system);
	return () => {
		window.removeEventListener(EVENT, handle);
		media.removeEventListener("change", system);
	};
}
