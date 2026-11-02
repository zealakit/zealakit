# Middleware and errors

## Middleware placement

Put reusable Hono middleware under `presentation/http/middleware/`. Apply at app or feature route level from bootstrap/presentation — not from domain/application.

## Error mapping

- Domain throws plain `Error` (or domain-specific errors) with messages/invariants.
- Catch or use `app.onError` in presentation/bootstrap to map to HTTP status + JSON body.
- Do not leak stack traces in production responses.

## Example pattern

```typescript
app.onError((err, c) => {
  if (err.message === "Item name cannot be empty") {
    return c.json({ message: err.message }, 400);
  }
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});
```

Keep mapping thin; add richer error types as the app grows.
