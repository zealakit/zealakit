# Prisma migrations

```bash
pnpm db:generate   # prisma generate — refresh client after schema changes
pnpm db:migrate    # prisma migrate dev — create + apply migration locally
pnpm db:studio     # prisma studio — inspect data
```

1. Edit `prisma/schema.prisma`.
2. `pnpm db:migrate` (review the generated SQL).
3. Commit `prisma/migrations` with the schema change.
4. In CI/production use `prisma migrate deploy` (add a script if needed).

Do not use `db push` as the only production workflow.
