import { getTranslation } from "@/i18n/get-translation";
import { Link } from "@/i18n/navigation";

export default async function AboutUsPage() {
  const t = await getTranslation(["common"]);

  return (
    <section style={{ display: "grid", gap: "0.75rem", maxWidth: "40rem" }}>
      <h1>{t("common:PAGE.ABOUT_US.TITLE")}</h1>
      <p>{t("common:PAGE.ABOUT_US.DESCRIPTION")}</p>
      <p>
        <Link href="/">{t("common:SITE.NAV.HOME")}</Link>
      </p>
    </section>
  );
}
