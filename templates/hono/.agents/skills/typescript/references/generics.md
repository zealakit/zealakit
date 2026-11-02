# Generics & advanced types

## Agent pitfalls

- Over-generic APIs are harder than concrete ones — constrain early.
- Avoid `T extends any` / unbounded `T` when a concrete union works.
- Conditional types + heavy inference can explode compile times — keep shallow.
- Don’t nest five layers of `infer` for one call site.
- Prefer `keyof` + mapped types over stringly-typed keys.

## Constrained generics

```ts
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((item) => item[key])
}
```

## Defaults

```ts
type ApiResponse<TData = unknown> = {
  data: TData
  status: number
}
```

## Conditional types

```ts
type IsString<T> = T extends string ? true : false
type NonNull<T> = T extends null | undefined ? never : T
```

## `infer`

```ts
type AwaitedLike<T> = T extends PromiseLike<infer U> ? U : T
type Elem<T> = T extends readonly (infer U)[] ? U : never
```

Prefer built-in `Awaited<T>`, `ReturnType<T>`, `Parameters<T>` when they fit.

## Mapped types

```ts
type ReadonlyDeep<T> = {
  readonly [K in keyof T]: T[K] extends object ? ReadonlyDeep<T[K]> : T[K]
}

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]
```

## Template literal types

```ts
type EventName = `on${Capitalize<"click" | "focus">}` // "onClick" | "onFocus"
```

Use for string protocols — not for open-ended user text.

## Variance intuition

- Callback parameters are checked **contravariantly** under `strictFunctionTypes`.
- Prefer explicit function types for public callbacks.

```ts
type Handler<T> = (event: T) => void
```

## When not to generic

If every call site uses the same three shapes, write three functions or a union — not `T extends ...` with ten branches.
