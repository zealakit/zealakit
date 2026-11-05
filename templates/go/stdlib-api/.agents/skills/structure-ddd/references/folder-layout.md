# Folder layout

```text
cmd/api/main.go
internal/
  bootstrap/
    app.go
    featurea.go              # feature composition factories
  domain/
    featurea/                # Item aggregate, VO, repository port
  application/
    featurea/                # CreateItem use case
  infrastructure/
    config/
    logging/
    persistence/featurea/    # in-memory ItemRepository adapter
  presentation/http/
    handler/                 # health, hello (non-domain samples)
    api/v1/featurea/         # feature HTTP handlers
    middleware/
    respond/
    router.go
    server.go
pkg/                         # public libs only if needed
```

## Where does X go?

| Need | Location |
| --- | --- |
| New REST endpoint for a feature | `presentation/http/api/v1/<feature>/` + register in `router.go` |
| Business rule / aggregate | `domain/<feature>/` |
| Use case | `application/<feature>/` |
| DB / external API client | `infrastructure/…` adapter |
| Wire constructors | `internal/bootstrap` (`featureX.go` + `app.go`) |
| Process entry / signals | `cmd/api/main.go` |
| Shared pure helper | small package under `internal/` (not `pkg/` unless public) |
