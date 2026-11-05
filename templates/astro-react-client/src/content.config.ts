import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const landingSchema = z.object({
  title: z.string(),
  description: z.string(),
  draft: z.boolean().default(false),
});

const articleSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default("Zealakit"),
  image: z.string().optional(),
  draft: z.boolean().default(false),
});

/** Marketing / landing Markdown (home, about, pricing, …). */
const landing = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/landing" }),
  schema: landingSchema,
});

/**
 * Optional local Markdown articles for micro / static sites.
 * Prefer CMS/API (`CMS_API_URL` + `src/lib/articles`) when content is frequent or editorial.
 */
const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
  schema: articleSchema,
});

export const collections = { landing, articles };
