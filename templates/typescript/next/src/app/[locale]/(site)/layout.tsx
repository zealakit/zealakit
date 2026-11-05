import { Suspense } from "react";
import { getTranslation } from "@/i18n/get-translation";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "../_shared/locale-switcher/server";
import { LocaleSwitcherSkeleton } from "../_shared/locale-switcher/skeleton";

export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslation(["common"]);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100%",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid color-mix(in oklab, currentColor 12%, transparent)",
        }}
      >
        <Link href="/">{t("common:SITE.BRAND")}</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <Link href="/">{t("common:SITE.NAV.HOME")}</Link>
            <Link href="/about-us">{t("common:SITE.NAV.ABOUT_US")}</Link>
          </nav>
          <Suspense fallback={<LocaleSwitcherSkeleton />}>
            <LocaleSwitcher />
          </Suspense>
        </div>
      </header>
      <main style={{ flex: 1, padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
