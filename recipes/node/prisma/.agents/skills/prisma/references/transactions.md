# Prisma transactions

Prefer interactive or sequential `$transaction` inside adapters when multiple writes must succeed or fail together:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.item.create({ data: … });
  await tx.auditLog.create({ data: … });
});
```

Keep transaction boundaries in persistence — domain services describe intent, not Prisma APIs.
