# TypeORM migrations

**Never use `synchronize: true` in production.** It can drop columns/tables and has no reviewable history. The recipe maps `DB_SYNCHRONIZE=true` only for local experiments — leave it unset (false) once you introduce migrations.

## Recommended shape

Use a dedicated CLI `DataSource` (same connection options as the app) with:

- `synchronize: false`
- `migrations: ["dist/.../migrations/*.js"]` (or your chosen out dir)
- entities aligned with Nest `autoLoadEntities` / Hono entity globs

Generate and run migrations via the TypeORM CLI (add scripts in `package.json` when you adopt them), for example:

```bash
pnpm typeorm migration:generate src/infrastructure/persistence/typeorm/migrations/AddUserAge -d path/to/data-source.js
pnpm typeorm migration:run -d path/to/data-source.js
```

Exact script names are project-specific; keep migration files under infrastructure, not domain.

## Migration practices

- Always implement `down` for rollback when feasible.
- Prefer additive, multi-step renames (add column → backfill → constrain → drop old) over destructive one-shots.
- Add indexes in the same migration that introduces hot query columns when you already know the access pattern.
- Do not hand-run `ALTER TABLE` in production outside the migration runner.

## Example sketch

```typescript
import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAge1705312800000 implements MigrationInterface {
  name = "AddUserAge1705312800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "age" integer DEFAULT 0`);
    await queryRunner.query(`CREATE INDEX "IDX_users_age" ON "users" ("age")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_age"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "age"`);
  }
}
```

## Nest tip

Prefer running migrations in deploy/CI (`migration:run`) rather than `migrationsRun: true` on every app boot, unless you explicitly want boot-time migrate for small services.

Docs: https://typeorm.io/migrations
