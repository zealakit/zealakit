# Go recipes

| Recipe | Driver | Environment |
| --- | --- | --- |
| `postgres` | `database/sql` + `github.com/jackc/pgx/v5/stdlib` | `DATABASE_URL`, `DB_*` |
| `mysql` | `database/sql` + `github.com/go-sql-driver/mysql` | `DATABASE_URL` (MySQL DSN), `DB_*` |
| `mongodb` | `go.mongodb.org/mongo-driver/v2` | `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_*` |

Select one database recipe when scaffolding:

```bash
zealakit create my-api -t stdlib-api -w mysql
zealakit create my-api -t gin-api -w mongodb
```

Database recipes are mutually exclusive; select only one per project. Each
recipe adds `internal/infrastructure/database`, appends the driver to `go.mod`,
and documents `.env.example`. Run `go mod tidy` once after scaffolding.

None of the recipes ship an ORM/ODM. Callers own the `*sql.DB` or
`*mongo.Client` lifecycle.
