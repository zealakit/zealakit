# TypeORM transactions

When several writes must succeed or fail together, wrap them in one transaction **inside the adapter** (or a unit-of-work port implemented with TypeORM). Do not leave “save A then save B” across separate repository calls without a shared transactional boundary when consistency matters.

## Prefer `DataSource.transaction`

```typescript
await this.dataSource.transaction(async (manager) => {
  const order = await manager.save(OrderOrmEntity, { userId, status: "pending" });
  for (const item of items) {
    await manager.save(OrderItemOrmEntity, { orderId: order.id, ...item });
    await manager.decrement(InventoryOrmEntity, { productId: item.productId }, "stock", item.quantity);
  }
  return order;
});
```

All work in the callback must use the same `manager` — not a separately injected `Repository` that talks outside the transaction.

## QueryRunner when you need manual control

```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  // … use queryRunner.manager …
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

## Hexagonal patterns

| Approach | When |
| --- | --- |
| Single adapter method runs the whole unit of work | One aggregate / one feature owns the multi-step write |
| Application opens a `UnitOfWork` / `Transaction` port | Multiple adapters must share one DB transaction |

If you introduce a transaction port, implement it with TypeORM in infrastructure and keep handlers free of `DataSource` imports.

## Incorrect

```typescript
await this.orderRepo.save(order);
await this.inventoryRepo.decrement(…);
await this.payment.charge(…); // failure leaves order + inventory already changed
```

Side effects that cannot roll back with the DB (external payments) need explicit compensation or an outbox — do not pretend `transaction()` covers them.

Docs: https://typeorm.io/transactions
