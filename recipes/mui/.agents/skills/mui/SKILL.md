---
name: mui
description: >-
  MUI (Material UI) project setup: MuiThemeProvider, ThemeProvider, theme tokens,
  and `@/components/ui` wrappers. Use when wrapping the app with the design system
  or editing theme (Vite or Next). For deep Next SSR/cache, theming, styling, or
  Tailwind + MUI, follow the sibling material-ui-* skills.
---

# UI kit (MUI)

This skill is present because the **UI recipe** is installed. It covers **this project's wiring**. Official Material UI deep guides live in sibling skills under `.agents/skills/`.

## Setup

- Theme tokens: `src/configs/theme.ts`
- App wrapper: `src/app/mui-theme-provider.tsx` (`ThemeProvider` + `CssBaseline`)
- Primitives: `src/components/ui/` (real files — one kebab-case file per primitive, barrel in `index.ts`)

**`material-ui-nextjs` scope:** only when working on a **Next.js** app (App/Pages Router, `app/` layouts, `@mui/material-nextjs`). Do **not** apply [.agents/skills/material-ui-nextjs/SKILL.md](../material-ui-nextjs/SKILL.md) on Vite, shared UI, theme tokens, or any non-Next tree.

### Vite

Keep `MuiThemeProvider` around `<App />` in `src/main.tsx`.

### Next.js (App Router)

Wire carefully — do **not** copy the Vite `main.tsx` pattern:

1. **Root** `src/app/layout.tsx`: wrap `{children}` with `AppRouterCacheProvider` from `@mui/material-nextjs/v16-appRouter` (Emotion SSR cache; avoid FOUC).
2. **Locale** `src/app/[locale]/layout.tsx`: wrap inside `NextIntlClientProvider` with client `MuiThemeProvider` (`"use client"`).

```tsx
// locale layout (simplified)
<NextIntlClientProvider>
  <MuiThemeProvider>{children}</MuiThemeProvider>
</NextIntlClientProvider>
```

Do **not** put `ThemeProvider` in the root layout as a second document shell, and do **not** nest a second `AppRouterCacheProvider` under the theme provider.

When upgrading Next major versions, switch the cache import to the matching entry (e.g. `v17-appRouter`) when `@mui/material-nextjs` publishes it.

Do not mount a second `ThemeProvider` in feature screens unless you are intentionally overriding theme.

For SSR cache options, fonts, Link `component` prop, CSS layers, and `useSearchParams` + Suspense, read [.agents/skills/material-ui-nextjs/SKILL.md](../material-ui-nextjs/SKILL.md) (**Next.js only**). Prefer this project's layout split above over generic `_app` / Pages Router examples unless you are on Pages Router.

## Imports

Prefer the project wrappers over the vendor package when a wrapper exists:

```ts
import { Button, TextField } from "@/components/ui";
```

When a primitive needs extra props or app-specific defaults, edit its file under `components/ui/` — do not import `@mui/material` from feature screens.

## Theme

Edit design tokens in `src/configs/theme.ts` (`createTheme`) and pass them through `ThemeProvider` (already wired in `MuiThemeProvider`).

Deeper token / dark-mode / `cssVariables` work → [.agents/skills/material-ui-theming/SKILL.md](../material-ui-theming/SKILL.md).

## Related Material UI skills

| Skill | When |
| --- | --- |
| [material-ui-nextjs](../material-ui-nextjs/SKILL.md) | **Next.js only** — App Router cache, fonts, Link, Suspense |
| [material-ui-theming](../material-ui-theming/SKILL.md) | `createTheme`, palette, color schemes, CSS variables |
| [material-ui-styling](../material-ui-styling/SKILL.md) | Choose `sx` vs `styled` vs theme overrides vs global CSS |
| [material-ui-tailwind](../material-ui-tailwind/SKILL.md) | Only if the app also uses Tailwind with MUI |
