# Drizzle queries & N+1

Drizzle does not lazy-load associations. N+1 almost always means the adapter (or caller) issued one query per parent in a loop. Fix with joins, `inArray` batching, or the relational query API.

## Incorrect

```typescript
const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, userId));
for (const order of orders) {
  order.items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
}
```

## Correct — SQL join / select

```typescript
const rows = await db
  .select({
    orderId: ordersTable.id,
    total: ordersTable.total,
    itemId: orderItems.id,
    quantity: orderItems.quantity,
  })
  .from(ordersTable)
  .leftJoin(orderItems, eq(orderItems.orderId, ordersTable.id))
  .where(eq(ordersTable.userId, userId));

// group rows → domain aggregates in the mapper
```

## Correct — batch `inArray`

```typescript
const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
```

## Correct — relational query API

When `relations()` are defined on the schema and the client is created with `{ schema }`:

```typescript
const orders = await db.query.ordersTable.findMany({
  where: eq(ordersTable.userId, userId),
  with: { items: { with: { product: true } } },
});
```

Still map to domain DTOs/aggregates before leaving the adapter if the port returns domain types.

## Hexagonal note

Prefer port methods that name the use-case shape (`findOrdersWithItems`) so handlers never loop “get order → get items”. That keeps join strategy inside infrastructure.

## Detecting N+1

Log SQL in development (driver `logger`, or wrap `db` with logging). Many nearly identical `WHERE order_id = $1` statements in one request are the smell.

Docs: https://orm.drizzle.team/docs/rqb
