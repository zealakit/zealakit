# TypeORM queries & N+1

N+1 happens when you load a list, then query related rows once per parent. Fix it with joins / `relations`, QueryBuilder, or explicit batch loads — **inside adapters**, not in domain or handlers that loop on ports carelessly.

## Incorrect (query per item)

```typescript
const orders = await this.orderRepo.find({ where: { userId } });
for (const order of orders) {
  order.items = await this.itemRepo.find({ where: { orderId: order.id } });
}
```

Also avoid returning entities with unloaded lazy relations and then touching them during serialization — each access can fire another query.

## Correct — `relations` / nested select

```typescript
return this.orderRepo.find({
  where: { userId },
  relations: { items: { product: true } },
  select: {
    id: true,
    total: true,
    status: true,
    items: { id: true, quantity: true, price: true },
  },
});
```

Prefer the object form of `relations` / `select` on current TypeORM versions.

## Correct — QueryBuilder joins

```typescript
return this.userRepo
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post")
  .leftJoinAndSelect("post.comments", "comment")
  .where("user.isActive = :active", { active: true })
  .getMany();
```

For aggregates / counts, use `leftJoin` + `addSelect` + `groupBy` and `getRawMany()` when you do not need full entities.

## Correct — batch by ids (port-friendly)

When the application layer has many parent ids, expose one port method that loads children in a single `IN (...)` query and groups in memory — similar to a DataLoader batch function. Keep the SQL in the adapter.

## Detecting N+1

Enable query logging in development (`logging: ["query", "error"]` on the DataSource / Nest options). A burst of nearly identical `SELECT … WHERE parent_id = ?` lines is the usual smell.

## Hexagonal note

Handlers should ask for **what they need** via the port (`findOrdersWithItems(userId)`), not open a TypeORM `Repository` and walk graphs. That keeps join strategy swappable and testable with an in-memory fake.
