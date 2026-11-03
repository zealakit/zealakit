---
name: vee-validate-zod
description: >-
  Form schemas and feature form composables for VeeValidate + Zod in this Vue SPA.
  Use when adding or changing forms, validation schemas, initialValues, or
  locale-aware error messages. Schemas live in lib/schemas/; composables live in the
  feature folder.
---

# VeeValidate + Zod

## Placement

| Artifact | Path |
| --- | --- |
| Zod schemas | `src/lib/schemas/<name>.schema.ts` |
| Barrel | `src/lib/schemas/index.ts` |
| Feature form hook | `src/app/features/<feature>/composables/use-<form>-form.ts` |

## Pattern

```ts
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { exampleSchema, type ExampleFormValues } from "@/lib/schemas";

const { handleSubmit, defineField, errors } = useForm<ExampleFormValues>({
  validationSchema: toTypedSchema(exampleSchema),
  initialValues: { name: "", email: "" },
});
```

Prefer schema factories that accept a `t` translator when copy must be localized.
Keep submit / API calls in the feature composable or screen — not inside `components/ui`.
