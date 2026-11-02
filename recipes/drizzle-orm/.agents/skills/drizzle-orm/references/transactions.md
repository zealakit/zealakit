# Drizzle transactions

Wrap multi-step writes in `db.transaction` so partial failure does not leave inconsistent rows.

## Basic pattern

```typescript
await db.transaction(async (tx) => {
  await tx.insert(ordersTable).values({ id: orderId, userId, status: "pending" });

  for (const item of items) {
    await tx.insert(orderItems).values({ orderId, ...item });
    await tx
      .update(inventory)
      .set({ stock: sql`${inventory.stock} - ${item.quantity}` })
      .where(eq(inventory.productId, item.productId));
  }
});
```

Use the **`tx`** handle for every statement inside the callback — not the outer `db`.

## Nested / savepoints

Drizzle supports nested transactions as savepoints on drivers that allow them. Prefer one explicit boundary per use-case unless you have a clear nesting need.

## Hexagonal patterns

| Approach | When |
| --- | --- |
| Adapter method owns `db.transaction` | One feature’s repository coordinates the writes |
| Application `UnitOfWork` / transaction port | Multiple adapters must share one `tx` |

If you introduce a transaction port, implement it by yielding `tx` (or a scoped client) from infrastructure; keep handlers free of `drizzle-orm` imports.

## Incorrect

```typescript
await db.insert(ordersTable).values(…);
await db.update(inventory).set(…);
await payments.charge(…); // DB already committed; charge failure ≠ rollback
```

Non-DB side effects need outbox / compensation — `transaction` only covers the database client.

Docs: https://orm.drizzle.team/docs/transactions
