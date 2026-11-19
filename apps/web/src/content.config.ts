import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** One Markdown file per release in src/content/changelog, newest shown first. */
const changelog = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/changelog" }),
	schema: z.object({
		version: z.string(),
		/** Release date; leave out while the release is still being prepared. */
		date: z.coerce.date().optional(),
		title: z.string(),
		summary: z.string(),
	}),
});

export const collections = { changelog };
