---
name: storybook
description: >-
  Storybook setup for documenting and testing UI components in isolation.
  Use when adding stories, configuring .storybook/, or running the Storybook
  workspace (Vite React or Next.js).
---

# Storybook

This skill is present because the **Storybook recipe** is installed.

## Setup

- Config: `.storybook/main.ts`, `.storybook/preview.ts`
- Example story: `src/stories/button.stories.tsx`
- Scripts: `pnpm storybook` (dev on `:6006`), `pnpm build-storybook`

### Framework

| Template | Package |
| --- | --- |
| Vite + React | `@storybook/react-vite` |
| Next.js | `@storybook/nextjs` |

Do not mix frameworks across templates.

## Writing stories

- Prefer CSF3: `meta` + named `Story` exports next to (or under `src/stories/` for) the component.
- Colocate feature stories as `*.stories.tsx` beside the component when the UI is feature-owned.
- Keep stories free of app-only providers unless the component needs them; wrap via `decorators` in the story or `preview.ts`.

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"; // or @storybook/nextjs
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: "Save" } };
```

## Notes

- Storybook is **not** a UI kit — use it alongside Ant Design / MUI / shadcn.
- Categories on this recipe: `ui`, `testing`, `documentation`.
