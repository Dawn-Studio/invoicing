import { SITE } from "../site";

const CACHE_KEY = "github-stars";
const CACHE_MS = 60 * 60 * 1000;

/**
 * The repository's star count, fetched in the browser (GitHub allows 60 unauthenticated
 * requests an hour per visitor) and cached for an hour. Null while the repo is private or
 * GitHub can't be reached, so callers show nothing rather than a wrong number.
 */
export async function fetchStars(): Promise<number | null> {
	try {
		const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as {
			repo: string;
			stars: number;
			at: number;
		} | null;
		if (cached && cached.repo === SITE.repo && Date.now() - cached.at < CACHE_MS) {
			return cached.stars;
		}
	} catch {
		// No storage or a bad entry: just fetch.
	}
	try {
		const response = await fetch(`https://api.github.com/repos/${SITE.repo}`, {
			headers: { Accept: "application/vnd.github+json" },
		});
		if (!response.ok) return null;
		const { stargazers_count: stars } = (await response.json()) as { stargazers_count?: number };
		if (typeof stars !== "number") return null;
		try {
			localStorage.setItem(CACHE_KEY, JSON.stringify({ repo: SITE.repo, stars, at: Date.now() }));
		} catch {
			// Fine, it'll fetch again next time.
		}
		return stars;
	} catch {
		return null;
	}
}

/** 999, 1.2k, 12k. */
export function formatStars(stars: number) {
	if (stars < 1000) return String(stars);
	const thousands = stars / 1000;
	return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.round(thousands)}k`;
}
