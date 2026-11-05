const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Keeps the `.dark` class on <html> in sync with the OS appearance. Returns a cleanup function. */
export function syncThemeWithSystem(root: HTMLElement = document.documentElement): () => void {
	const media = window.matchMedia(DARK_QUERY);
	const apply = () => root.classList.toggle("dark", media.matches);
	apply();
	media.addEventListener("change", apply);
	return () => media.removeEventListener("change", apply);
}
