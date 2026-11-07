<script lang="ts">
  import { useDocumentTitle } from "@/composables/use-document-title.svelte";
  import { ROUTES } from "@/configs/routes";
  import {
    locale,
    type LocaleCode,
    setLocale,
    translate,
  } from "@/configs/i18n.svelte";

  const title = $derived(translate("APP.TITLE"));
  const description = $derived(translate("APP.DESCRIPTION"));
  const languageLabel = $derived(translate("LANGUAGE.LABEL"));

  useDocumentTitle(() => title);

  function handleLocaleChange(event: Event): void {
    setLocale((event.currentTarget as HTMLSelectElement).value as LocaleCode);
  }
</script>

<section class="page">
  <h1>{title}</h1>
  <p>{description}</p>

  <div class="language-switcher">
    <label for="locale">{languageLabel}</label>
    <select id="locale" value={locale.current} onchange={handleLocaleChange}>
      <option value="en">{translate("LANGUAGE.EN")}</option>
      <option value="vi">{translate("LANGUAGE.VI")}</option>
    </select>
  </div>

  <a class="button-link" href={ROUTES.featureA}>{translate("APP.OPEN_FEATURE_A")}</a>
</section>
