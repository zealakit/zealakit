# Add an endpoint

## Static / infra endpoint (no domain)

Example: `GET /api/v1/ping`

1. Add `internal/presentation/http/handler/ping.go`.
2. Register in `router.go`: `mux.HandleFunc("GET /api/v1/ping", handler.Ping)`.
3. Add an `httptest` test.
4. Run `go test ./...`.

Do **not** create a domain entity just to return a static JSON payload.

## Feature endpoint (business logic)

Follow [feature-a-walkthrough.md](feature-a-walkthrough.md):

1. Domain types/ports under `internal/domain/<feature>/`
2. Use case under `internal/application/<feature>/`
3. Adapter under `internal/infrastructure/…` when persistence is needed
4. Thin HTTP handler under `internal/presentation/http/api/v1/<feature>/`
5. Wire in `internal/bootstrap/<feature>.go` and register the route
