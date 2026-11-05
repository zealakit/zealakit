---
name: hookform-zod
description: >-
  Form schemas and feature form hooks for React Hook Form + Zod + i18n in this
  SPA. Use when adding or changing forms, validation schemas, defaultValues, or
  locale-aware error messages. Schemas live in lib/schemas/; hooks live in the
  feature folder.
---

# Forms (React Hook Form + Zod)

This skill is present because the **form recipe** is installed. Put artifacts in the folders below.

Schemas live in `lib/schemas/`. Feature form logic lives in `features/<feature>/hooks/use-<feature>-form.ts`.

## Core rules

1. **Schema factory, not a static schema.** Export `getXxxCreateSchema({ t })` so validation messages stay locale-aware.
2. **Validation copy from i18n only.** Prefer keys under `message:` (e.g. `message:ERROR.PLEASE_ENTER_VALUE`). Never hardcode language strings in schemas.
3. **Enums / defaults from constants.** Use `CONSTANTS` — no magic strings for status or type codes.
4. **Create vs update.** Prefer `getXxxUpdateSchema = getXxxCreateSchema` when shapes match; split only when update fields differ.
5. **Infer values from the factory return:** `z.infer<ReturnType<typeof getXxxCreateSchema>>`.

## Placement & naming

| Artifact | Path / name | Example |
| --- | --- | --- |
| Schema module | `src/lib/schemas/<resource>.schema.ts` | `example.schema.ts` |
| Factory | `get<Resource><Intent>Schema` | `getExampleCreateSchema` |
| Update alias | `getXxxUpdateSchema = getXxxCreateSchema` when identical | — |

Locale keys for validation live in `assets/locales/<lang>/message.json` (same key in every language folder).

## Schema factory

```ts
// lib/schemas/example.schema.ts
import { z } from "zod";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const getExampleCreateSchema = ({ t }: { t: Translate }) =>
  z.object({
    name: z
      .string(t("message:ERROR.PLEASE_ENTER_VALUE"))
      .min(1, t("message:ERROR.PLEASE_ENTER_VALUE")),
    email: z.email(t("message:ERROR.INVALID_VALUE")),
  });

export const getExampleUpdateSchema = getExampleCreateSchema;

export type ExampleCreateValues = z.infer<ReturnType<typeof getExampleCreateSchema>>;
```

Do not invent constant groups. Use existing `CONSTANTS` (`ROUTES`, `APIS`, `LOCALES`, `STORAGE`) and add a feature constants file when enums are needed.

## Common field patterns

| Case | Pattern |
| --- | --- |
| Required string | `z.string(t(...)).min(1, t(...))` |
| Required select / multi | `.refine` with `PLEASE_SELECT_VALUE` / `INVALID_VALUE` |
| Boolean with default | `z.boolean().default(true)` |
| Enum from constants | `z.enum(CONSTANTS....).default(...)` |
| Optional nullable | `z.string().optional().nullable()` |

## Feature form hook

Build the schema **inside** the hook where `t` is available, then pass it to `zodResolver`.

```ts
// app/features/feature-a/hooks/use-feature-a-form.ts
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  getExampleCreateSchema,
  type ExampleCreateValues,
} from "@/lib/schemas/example.schema";

export function useFeatureACreateForm(defaultValues?: Partial<ExampleCreateValues>) {
  const { t } = useTranslation();
  const schema = useMemo(() => getExampleCreateSchema({ t }), [t]);

  const form = useForm<ExampleCreateValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      ...defaultValues,
    },
    mode: "onSubmit",
  });

  return { form, schema, t };
}
```

Rebuild the schema when `t` changes (`useMemo(..., [t])`) so messages follow the active language.

## Wire in the screen

Keep the screen thin: call the hook, submit handler → `apis.*`.

```tsx
import { apis } from "@/lib/apis";
import { useFeatureACreateForm } from "./hooks/use-feature-a-form";

export function FeatureACreate() {
  const { form, t } = useFeatureACreateForm();
  const { handleSubmit } = form;

  const onSubmit = handleSubmit(async (values) => {
    await apis.example.createExample(values);
  });

  return (
    <form onSubmit={onSubmit}>
      {/* Labels: t("field:NAME.LABEL") — errors come from the schema via form state */}
      {/* Actions: t("action:CREATE.LABEL") */}
    </form>
  );
}
```

## Form copy namespaces

| Concern | Namespace | Example |
| --- | --- | --- |
| Field labels / placeholders | `field:` | `t("field:NAME.LABEL")` |
| Actions | `action:` | `t("action:CREATE.LABEL")` |
| Validation / toasts | `message:` | `t("message:ERROR.PLEASE_ENTER_VALUE")` |
| Shared UI nouns | `common:` | `t("common:TEST")` |

## Checklist (new form)

```
[ ] Add/extend keys in every language folder (message, field, action as needed)
[ ] Create getXxxCreateSchema({ t }) in lib/schemas/<resource>.schema.ts
[ ] Reuse or split getXxxUpdateSchema
[ ] Export the inferred values type from the factory
[ ] Feature hook: useMemo schema from t + useForm + zodResolver
[ ] defaultValues cover every required field
[ ] No hardcoded validation strings; no magic status enums in JSX
```
