---
name: tanstack-query
description: Fetch, cache and mutate server state with TanStack Query. Use when adding API calls, loading/error states, cache invalidation, or optimistic updates.
---

# TanStack Query

The query client is mounted for you (React: `QueryProvider`; Vue: `VueQueryPlugin`; Svelte: `QueryClientProvider` in the root layout). Defaults: `staleTime` 60s, one retry.

## Conventions

- Keep query hooks in `src/lib/query/` (Nuxt: `app/composables/`), one hook per resource, e.g. `useExamplesQuery`. See the example hook there.
- Query keys are arrays, most general first: `["examples"]`, `["examples", id]`. Invalidate with the shared prefix: `queryClient.invalidateQueries({ queryKey: ["examples"] })`.
- Fetch functions throw on non-2xx so errors reach `error` / `isError`. Wrap your HTTP client (fetch, Ky, Axios) inside `queryFn`; this recipe does not replace it.
- Use `useMutation` for writes, then invalidate the affected keys in `onSuccess`.
- Do not copy query data into component state; read it from the hook.
- Next.js: hooks and the provider are client code (`"use client"`). Prefetch on the server only when you also set up hydration.
