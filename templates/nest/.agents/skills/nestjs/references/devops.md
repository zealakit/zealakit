# DevOps & deployment

## Do

- Graceful shutdown: listen for signals, stop traffic, flush work (`enableShutdownHooks`)
- `ConfigModule` / validated config schema — no scattered `process.env` in domain
- Structured logs (JSON) with request/correlation ids
- Fail fast on missing required env at bootstrap

## Don't

- Log secrets or full PII payloads
- Ignore open handles (DB pools, timers) on shutdown
