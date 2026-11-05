export type HomeHeroBannerData = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: "/about-us";
};

export type HomeSolutionItem = {
  id: string;
  title: string;
  description: string;
};

export type HomeSolutionsData = {
  title: string;
  items: HomeSolutionItem[];
};

/** Simulated server-side homepage data (SSR / SEO). */
export async function getHomeHeroBanner(): Promise<HomeHeroBannerData> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    title: "Ship multilingual Next.js sites faster",
    description:
      "Hero banner is rendered on the server so search engines see the full headline and CTA.",
    ctaLabel: "About us",
    ctaHref: "/about-us",
  };
}

/** Simulated client-fetched homepage data (CSR / lighter TTFB). */
export async function getHomeSolutions(): Promise<HomeSolutionsData> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  return {
    title: "Solutions",
    items: [
      {
        id: "i18n",
        title: "Locale routing",
        description: "Prefix-based routes with next-intl navigation helpers.",
      },
      {
        id: "rsc",
        title: "Server Components",
        description: "Keep SEO-critical sections on the server by default.",
      },
      {
        id: "csr",
        title: "Deferred sections",
        description: "Load interactive or secondary blocks on the client.",
      },
    ],
  };
}
