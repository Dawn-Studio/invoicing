import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { SITE } from "./src/site";

export default defineConfig({
	site: SITE.url,
	// /download, not /download/: matches the canonical URLs and the sitemap.
	trailingSlash: "never",
	build: { format: "file" },
	integrations: [react(), sitemap()],
	vite: {
		plugins: [tailwindcss()],
	},
});
