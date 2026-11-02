# Narrowing & type safety

## Agent pitfalls

- `as Type` hides bugs — prefer control-flow narrowing.
- Non-null `!` is almost always wrong at domain boundaries.
- `typeof null === "object"` — check `!== null` explicitly.
- Excess property checks apply to **fresh object literals**, not variables.
- `in` narrowing needs care with optional keys / prototypes.

## Control-flow narrowing

```ts
function len(x: string | string[] | null) {
  if (x == null) return 0
  if (typeof x === "string") return x.length
  return x.length
}
```

## Discriminated unions

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; w: number; h: number }

function area(s: Shape) {
  switch (s.kind) {
    case "circle":
      return Math.PI * s.radius ** 2
    case "rect":
      return s.w * s.h
  }
}
```

## User-defined type guards

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
```

Prefer `value is T` for reusable guards; `asserts value is T` for functions that throw.

## Exhaustiveness

```ts
function assertNever(x: never): never {
  throw new Error(`Unexpected: ${String(x)}`)
}

function label(s: Shape) {
  switch (s.kind) {
    case "circle":
      return "circle"
    case "rect":
      return "rect"
    default:
      return assertNever(s)
  }
}
```

## Assertions (last resort)

```ts
// Trusted boundary only (e.g. after runtime schema validation)
const user = JSON.parse(text) as unknown
// then narrow with guards — don't cast straight to User
```

## Index access

With `noUncheckedIndexedAccess`:

```ts
const xs = ["a", "b"]
const first = xs[0] // string | undefined
if (first !== undefined) {
  first.toUpperCase()
}
```

## Optional properties

With `exactOptionalPropertyTypes`, `{ name?: string }` does not accept `{ name: undefined }` unless the type allows it. Prefer explicit `| undefined` when both states are valid.
