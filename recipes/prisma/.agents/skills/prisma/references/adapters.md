# Prisma adapters

## schema.prisma

- Models and enums live only in `prisma/schema.prisma`.
- Do not treat generated types as domain entities — map in the adapter (or a persistence mapper next to it).

## PRISMA token

- Nest: inject `@Inject(PRISMA)`.
- Hono: pass the client from `createPrismaClient()` at the composition root.
- Keep the Symbol in `prisma.token.ts` so adapters stay decoupled from Nest/Hono specifics where possible.

## Repository adapter shape

```typescript
// infrastructure/persistence/feature-a/item.repository.adapter.ts
export class ItemRepositoryAdapter /* implements ItemRepository */ {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    const row = await this.prisma.item.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
}
```

Domain keeps `domain/.../item.repository.ts` as the port interface only.
