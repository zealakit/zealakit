---
name: svelte
description: >-
  Svelte 5 + SvelteKit practices for this app. Use when generating or refactoring
  components, runes, event handlers, route navigation, or shared UI. Does not
  pick a UI kit, HTTP client, or store — those come from recipes.
---

# Svelte 5 + SvelteKit (this app)

Assume modern Svelte knowledge. Prefer
[project-structure](../project-structure/SKILL.md) for where files go. This
skill only encodes **repo conventions** and **Svelte 5 / SvelteKit priorities**.

## Hard rules

- kebab-case **files/folders**; PascalCase **component imports**
- Use **Svelte 5 runes**: `$state`, `$derived`, `$effect`, `$props`
- Use event attributes (`onclick`, `oninput`, `onsubmit`) — never legacy `on:click`
- Use `{@render children()}` instead of `<slot />` for new components
- Route navigation: `goto()` from `$app/navigation`, `page` from `$app/state`
- Do **not** add route files outside `src/routes/`
- Prefer `type` over `interface`; path aliases `@/*` and `$lib/*`

## Component shape

```svelte
<script lang="ts">
  type Props = {
    label: string;
    onselect?: (value: string) => void;
  };

  let { label, onselect }: Props = $props();
  let open = $state(false);
  const title = $derived(label.trim());
</script>

<button type="button" onclick={() => (open = !open)}>
  {title}
</button>
```

- Declare props with `$props()` and an explicit `type`.
- Derive values with `$derived` instead of manual synchronization.
- Keep effects for external synchronization only; do not use `$effect` to
  compute state that can be derived.
- Shared runes go in `.svelte.ts` files.

## SvelteKit navigation

```svelte
<script lang="ts">
  import { goto } from "$app/navigation";
  import { ROUTES } from "@/configs/routes";
</script>

<a href={ROUTES.featureA}>Feature A</a>
<button type="button" onclick={() => void goto(ROUTES.overview)}>Home</button>
```

- Do not hardcode URLs in components; use `ROUTES`.
- Route files only wire a path to a feature screen.

## i18n

This template provides `src/configs/i18n.svelte.ts`:

- default locale `en`, fallback `en`
- locales detected from `CONSTANTS.STORAGE.LOCALE`
- `translate(key)` for typed common/action/field/message keys
- `setLocale("en" | "vi")` for reactive switching

Locale JSON lives in `src/assets/locales/<locale>/{common,action,field,message}.json`.
Read the current locale through `locale.current`; never read `i18n.language` directly
in a component (it is not reactive).

```svelte
<script lang="ts">
  import { setLocale, translate } from "@/configs/i18n.svelte";
  const title = $derived(translate("APP.TITLE"));
</script>

<h1>{title}</h1>
```

## Styling

- Global styles live in `src/styles/globals.css` and are imported once by the
  root `+layout.svelte`.
- Component-scoped styles stay inside the `.svelte` file.
- Prefer semantic elements and visible focus states.

## Performance

- Avoid creating large derived structures on every keystroke.
- Keep list keys stable (`{#each items as item (item.id)}`).
- Prefer SvelteKit route-level code splitting over manual dynamic imports.
