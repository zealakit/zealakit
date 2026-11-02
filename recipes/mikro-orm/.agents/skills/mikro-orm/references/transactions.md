# MikroORM transactions & Unit of Work

MikroORM already batches work until `flush`. For multi-step consistency across entities, use an explicit transaction so a mid-flight failure rolls back the whole unit.

## Prefer `em.transactional`

```typescript
await em.transactional(async (tem) => {
  const order = tem.create(OrderOrmEntity, { userId, status: "pending" });
  tem.persist(order);

  for (const item of items) {
    tem.persist(tem.create(OrderItemOrmEntity, { order, ...item }));
    const inventory = await tem.findOneOrFail(InventoryOrmEntity, { productId: item.productId });
    inventory.stock -= item.quantity;
  }

  // flush happens at end of transactional callback (unless nested differently)
});
```

Use the `tem` (transactional EM) for **all** reads/writes inside the callback.

## Nested work / isolation

- Nesting `transactional` follows MikroORM’s nesting rules — prefer one clear boundary per use-case.
- Set isolation level via driver options when you need stricter read guarantees (document why).

## Hexagonal patterns

| Approach | When |
| --- | --- |
| One adapter method wraps `em.transactional` | Single feature owns the multi-write |
| Application `UnitOfWork` port | Multiple adapters share one flush/transaction |

Implement any UoW port with MikroORM in infrastructure; handlers stay free of `EntityManager`.

## Incorrect

```typescript
await orderAdapter.save(order);      // flush #1
await inventoryAdapter.decrement(…); // flush #2 — partial commit if payment fails next
await payments.charge(…);
```

External side effects are not covered by DB rollback — use outbox / compensation.

Docs: https://mikro-orm.io/docs/transactions
