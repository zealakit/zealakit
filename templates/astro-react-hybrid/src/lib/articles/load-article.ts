import { getEntry } from "astro:content";
import type { Locale } from "@/i18n/config";
import type { Article, ArticleFromCms, ArticleMeta } from "./types";

export type { Article, ArticleFromCms, ArticleFromContent, ArticleMeta } from "./types";

function cmsBaseUrl(): string | undefined {
  const raw = import.meta.env.CMS_API_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : undefined;
}

function metaFromCms(payload: ArticleFromCms, slug: string): ArticleFromCms {
  return {
    ...payload,
    source: "cms",
    slug: payload.slug || slug,
  };
}

/**
 * Resolve one article for a locale.
 *
 * 1. `CMS_API_URL` set → fetch from CMS/BFF (production / editorial workflow)
 * 2. Else → `src/content/articles` Markdown (micro / mostly-static sites)
 */
export async function loadArticle(
  slug: string | undefined,
  locale: Locale,
): Promise<Article | null> {
  if (!slug) return null;

  const base = cmsBaseUrl();
  if (base) {
    const url = new URL(`${base}/articles/${encodeURIComponent(slug)}`);
    url.searchParams.set("locale", locale);

    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`CMS article fetch failed (${response.status}): ${url}`);
    }

    const payload = (await response.json()) as ArticleMeta & { bodyHtml: string };
    return metaFromCms({ ...payload, source: "cms" }, slug);
  }

  const entry = await getEntry("articles", slug);
  if (!entry || entry.data.draft) return null;

  const { title, description, pubDate, updatedDate, author, image } = entry.data;
  return {
    source: "content",
    entry,
    slug,
    title,
    description,
    pubDate: pubDate.toISOString(),
    updatedDate: updatedDate?.toISOString(),
    author,
    image,
  };
}
