# Microservices

Use only when this app truly splits processes. Prefer modular monolith first.

## Do

- Health/readiness endpoints for orchestrators
- Clear **message vs event** semantics (command expecting reply vs fire-and-forget)
- Queues/workers for slow/background work; idempotent consumers
- Timeouts, retries with backoff, and dead-letter strategy

## Don't

- Chatty sync cross-service calls for every request without a boundary
- Shared databases as an implicit API between services
