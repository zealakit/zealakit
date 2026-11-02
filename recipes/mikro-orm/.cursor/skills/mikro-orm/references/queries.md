# MikroORM queries & N+1

MikroORM’s Unit of Work + collections make N+1 easy if you iterate parents and touch unpopulated relations. Load what you need up front with `populate`, joins, or one batched query.

## Incorrect

```typescript
const orders = await em.find(OrderOrmEntity, { user: userId });
for (const order of orders) {
  await order.items.loadItems(); // or touching a Collection → N queries
}
```

## Correct — populate

```typescript
const orders = await em.find(
  OrderOrmEntity,
  { user: userId },
  { populate: ["items", "items.product"] },
);
```

Use `fields` / partial loading when you only need a projection.

## Correct — QueryBuilder

```typescript
const users = await em
  .createQueryBuilder(UserOrmEntity, "u")
  .leftJoinAndSelect("u.posts", "p")
  .where({ isActive: true })
  .getResultList();
```

## Correct — batch by parent ids

```typescript
const items = await em.find(OrderItemOrmEntity, { order: { $in: orderIds } });
// group by order id in the adapter before mapping to domain
```

Expose a single port method such as `findOrdersWithItems` so handlers do not orchestrate N repository calls.

## Identity map pitfalls

- Reusing one `EntityManager` across HTTP requests can return stale entities and hide bugs — fork per request.
- `em.clear()` after a large read-only batch if you must keep a long-lived EM.

## Detecting N+1

Enable debug logging (`debug: true` or driver logger) in development and watch for repeated identical selects while handling one request.

Docs: https://mikro-orm.io/docs/entity-manager#populating-relations
