---
name: antd
description: >-
  Ant Design setup: AntdThemeProvider, ConfigProvider, and theme tokens. Use
  when wrapping the app with the design system or editing theme (Vite or Next).
---

# UI kit (Ant Design)

This skill is present because the **UI recipe** is installed.

## Setup

- Theme tokens: `src/configs/theme.ts`
- App wrapper: `src/app/antd-theme-provider.tsx` (`ConfigProvider` + Ant Design `App` for static `message` / `modal` APIs)
- Primitives: `src/components/ui/` (real files — one kebab-case file per primitive, barrel in `index.ts`)

### Vite

Keep `AntdThemeProvider` around `<App />` in `src/main.tsx`.

### Next.js (App Router)

Wire carefully — do **not** copy the Vite `main.tsx` pattern:

1. **Root** `src/app/layout.tsx`: wrap `{children}` with `AntdRegistry` from `@ant-design/nextjs-registry` (SSR style extraction; avoid FOUC).
2. **Locale** `src/app/[locale]/layout.tsx`: wrap inside `NextIntlClientProvider` with client `AntdThemeProvider` (`"use client"`).

```tsx
// locale layout (simplified)
<NextIntlClientProvider>
  <AntdThemeProvider>{children}</AntdThemeProvider>
</NextIntlClientProvider>
```

Do **not** put `ConfigProvider` / `AntdThemeProvider` in the root layout as a second document shell, and do **not** nest a second `AntdRegistry` under the theme provider.

Do not mount a second `ConfigProvider` in feature screens unless you are intentionally overriding theme.

## Imports

Prefer the project wrappers over the vendor package when a wrapper exists:

```ts
import { Button, Input } from "@/components/ui";
```

When a primitive needs extra props or app-specific defaults, edit its file under `components/ui/` — do not import `antd` from feature screens.

## Theme

Edit design tokens in `src/configs/theme.ts` and pass them through `ConfigProvider` (already wired in `AntdThemeProvider`).
