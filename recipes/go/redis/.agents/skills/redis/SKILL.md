---
name: redis
description: Use Redis from this Go service with go-redis. Use when adding caching, rate limits, or queues, or when wiring the client lifecycle.
---

# Redis (go-redis)

The recipe provides `internal/infrastructure/cache`:

```go
rdb, err := cache.Open(ctx)
if err != nil {
	return nil, fmt.Errorf("open redis: %w", err)
}
defer rdb.Close()
```

## Configuration

| Variable | Required | Default |
| --- | --- | --- |
| `REDIS_URL` | yes | — (e.g. `redis://localhost:6379/0`) |
| `REDIS_DIAL_TIMEOUT` | no | `5s` |

## Conventions

- Open the client in the composition root and close it during graceful shutdown.
- Always pass the request `context.Context`; set a TTL on every key you write.
- Hide Redis behind a small port in your application layer (`Cache`, `RateLimiter`) so the domain never imports go-redis.
- Namespace keys (`<service>:<entity>:<id>`).
