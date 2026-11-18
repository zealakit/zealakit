# Layer rules

## Allowed imports

| From | May import |
| --- | --- |
| `domain` | stdlib only (no `net/http`, no infrastructure) |
| `application` | `domain`, stdlib |
| `presentation` | `application`, `domain` (types only if needed), sibling http helpers |
| `infrastructure` | `domain` (to implement ports), stdlib |
| `bootstrap` | all internal packages (composition root) |
| `cmd` | `bootstrap` (+ stdlib) |

## Must not

- Put SQL, HTTP, or env parsing in `domain`
- Call infrastructure adapters from handlers
- Create a DI container framework — use constructors
- Add Gin/Fiber/Echo/Chi “just because”
- Copy Nest/Hono TypeScript patterns literally (no decorators, no `@Injectable`)
