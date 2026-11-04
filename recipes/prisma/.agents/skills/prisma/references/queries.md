# Prisma queries

- Prefer `select` / `include` for the fields you need.
- Avoid N+1: load relations in one query, or batch with `in`.
- Put query details in adapters — application handlers call ports, not Prisma.

```typescript
// Bad
for (const id of ids) {
  await prisma.item.findUnique({ where: { id } });
}

// Good
await prisma.item.findMany({ where: { id: { in: ids } } });
```
