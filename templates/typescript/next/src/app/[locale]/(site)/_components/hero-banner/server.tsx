import { getHomeHeroBanner } from "../../_handlers";
import { HeroBannerTemplate } from "./template";

/** SSR export — import this from pages that need SEO-ready HTML. */
export async function HeroBanner() {
  const data = await getHomeHeroBanner();
  return <HeroBannerTemplate {...data} />;
}
