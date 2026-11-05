# Performance

## Do

- Prefer async lifecycle hooks; don’t block `onModuleInit` with long sync work
- Lazy-load heavy optional modules when cold start matters
- Cache read-heavy, stable data deliberately (TTL + invalidation plan)
- Push N+1 / query shape guidance to the **ORM recipe** skill

## Don't

- Cache unbounded in-process maps for multi-instance deploys without a shared store
- Await independent I/O serially when it can be parallel (`Promise.all`)
- Premature micro-optimizations before measuring
