# Composition root

`internal/bootstrap` is the **only** place that should know concrete adapter types and assemble the graph.

```text
cmd/api/main.go
  └─ bootstrap.New()
       ├─ config.Load()
       ├─ logging.New(...)
       ├─ newFeatureA()                  # repo → use case → HTTP handler
       ├─ httpapi.NewRouter(deps)
       └─ httpapi.NewServer(cfg, logger, router)
  └─ app.Run(ctx)  // graceful shutdown via context
```

## Rules

1. Handlers receive use cases via constructors — never construct adapters inside handlers.
2. Do not use `init()` for wiring side effects.
3. Keep `main` thin: signals + `bootstrap.New` + `Run`.
4. When adding a feature factory, put it next to bootstrap (e.g. `bootstrap/featurea.go`) and call it from `New`.
