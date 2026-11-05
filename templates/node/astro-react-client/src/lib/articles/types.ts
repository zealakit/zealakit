import type { CollectionEntry } from "astro:content";

/** Normalized article fields used for SEO + chrome (CMS or content collection). */
export type ArticleMeta = {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  author: string;
  image?: string;
};

/** CMS / API payload — body already rendered (or trusted HTML from the CMS). */
export type ArticleFromCms = ArticleMeta & {
  source: "cms";
  bodyHtml: string;
};

/** Local Markdown/MDX entry — render with `astro:content` `render()`. */
export type ArticleFromContent = ArticleMeta & {
  source: "content";
  entry: CollectionEntry<"articles">;
};

export type Article = ArticleFromCms | ArticleFromContent;
