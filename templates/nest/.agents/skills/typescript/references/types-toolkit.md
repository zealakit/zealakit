# Types toolkit

## Agent pitfalls

- `Partial<T>` makes every key optional — often too weak for updates (prefer explicit patch types).
- `Record<string, T>` accepts any key — good for maps, bad for closed domains.
- Branding is a pattern, not a language feature — don’t overuse.
- `satisfies` checks without widening — better than `as const` alone when you need both.

## Useful built-ins

| Type | Role |
| --- | --- |
| `Partial<T>` / `Required<T>` / `Readonly<T>` | Modifier mapped types |
| `Pick<T, K>` / `Omit<T, K>` | Structural subsets |
| `Exclude<T, U>` / `Extract<T, U>` | Union filtering |
| `NonNullable<T>` | Drop `null` \| `undefined` |
| `ReturnType<F>` / `Parameters<F>` | Function reflection |
| `Awaited<T>` | Unwrap promises |
| `Record<K, V>` | Keyed maps |
| `Uppercase` / `Lowercase` / `Capitalize` | String ops |

## `satisfies`

```ts
const routes = {
  home: "/",
  user: "/users/:id",
} as const satisfies Record<string, `/${string}`>
```

Keeps literal inference while verifying assignability.

## Branded / opaque IDs

```ts
type UserId = string & { readonly __brand: "UserId" }

function UserId(value: string): UserId {
  return value as UserId
}

function loadUser(id: UserId) {
  /* ... */
}
```

Use at domain boundaries to avoid mixing `string` IDs.

## Result-style unions

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

Prefer over throwing for expected failures in libraries.

## Const type parameters (TS 5+)

```ts
function tuple<const T extends readonly unknown[]>(...args: T): T {
  return args
}

const t = tuple(1, "a") // readonly [1, "a"]
```

## Object type style

```ts
// Extendable public contracts
interface User {
  id: string
  name: string
}

// Unions / mapped / aliases
type Id = string | number
type Flags = { [K in "a" | "b"]: boolean }
```
