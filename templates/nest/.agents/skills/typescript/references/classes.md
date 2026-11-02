# Classes & OOP typing

## Agent pitfalls

- Prefer composition; classes are optional in TS.
- Parameter properties (`constructor(private x: T)`) emit runtime code — blocked by `erasableSyntaxOnly`.
- `private` is compile-time only; use `#field` for true runtime privacy when needed.
- Always mark intentional overrides with `override` (`noImplicitOverride`).
- Don’t type Node/DOM `this` loosely in callbacks — use arrows or explicit `this` params.

## Class basics

```ts
class Counter {
  #value = 0

  get value() {
    return this.#value
  }

  inc() {
    this.#value += 1
  }
}
```

## Implements vs extends

```ts
interface Repo {
  find(id: string): Promise<unknown>
}

class MemoryRepo implements Repo {
  async find(id: string) {
    return { id }
  }
}
```

`implements` checks the instance shape — it does not preserve parameter variance tricks.

## Explicit fields (erasable-friendly)

```ts
class Service {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }
}
```

## Abstract classes

Use sparingly. Prefer interfaces + functions unless you need shared protected implementation.

## `this` parameters

```ts
function bindName(this: { name: string }) {
  return this.name
}
```

## Mixins

Possible but costly for inference. Prefer plain composition (`createFeature(base)`).
