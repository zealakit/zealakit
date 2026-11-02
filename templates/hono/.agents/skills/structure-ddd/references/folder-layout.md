# Folder layout

Canonical `src/` tree for this repository (layer → feature).

```text
src/
├── application/
│   ├── feature-a/
│   │   ├── commands/
│   │   ├── queries/
│   │   ├── handlers/
│   │   ├── dtos/
│   │   ├── mappers/
│   │   ├── tokens/
│   │   └── ports/
│   │       ├── input/
│   │       └── output/
│   └── feature-b/                    # same shape as feature-a
├── bootstrap/
│   ├── main.ts
│   ├── create-app.ts
│   ├── container.ts
│   └── modules/
│       ├── feature-a.ts
│       └── feature-b.ts
├── domain/
│   ├── feature-a/
│   │   ├── aggregates/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── events/
│   │   └── repositories/             # ports (interfaces)
│   └── feature-b/
├── infrastructure/
│   ├── persistence/
│   │   ├── feature-a/
│   │   │   ├── entities/             # ORM/persistence models
│   │   │   ├── mappers/
│   │   │   └── *.repository.adapter.ts
│   │   └── feature-b/
│   ├── cache/redis/
│   ├── messaging/rabbitmq/
│   ├── http-clients/external-provider/   # ACL — vendor name here, not in domain
│   └── security/crypto/
├── presentation/
│   └── http/
│       ├── api/v1/<feature>/{dto,docs,<feature>.routes.ts}
│       ├── webhooks/
│       └── middleware/
└── shared/
    ├── constants/
    ├── types/
    └── utils/
```

## Where does X go?

| You are adding… | Put it in… |
| --- | --- |
| Invariant / factory on a business object | `domain/<f>/aggregates/` or `entities/` |
| Typed ID / money / email wrapper | `domain/<f>/value-objects/` |
| Something that happened in the domain | `domain/<f>/events/` |
| “Save/load aggregate” contract | `domain/<f>/repositories/` + `application/<f>/ports/output/` |
| Use-case orchestration | `application/<f>/handlers/` |
| Intent from UI/API | `application/<f>/commands/` or `queries/` |
| Port identity `Symbol` | `application/<f>/tokens/` |
| REST routes / HTTP DTO | `presentation/http/api/v1/<f>/` |
| DB row model + repository impl | `infrastructure/persistence/<f>/` |
| Redis / Rabbit / 3rd-party HTTP | matching `infrastructure/*` folder |
| Composition wiring | `bootstrap/modules/<f>.ts` + `container.ts` |
| Pure helper with no policy | `shared/` |

## Empty directories

Keep `.gitkeep` in unused subfolders of a skeleton feature so the layout stays discoverable.
