# Error Handling

## Do

- Let async errors propagate (or rethrow); never swallow with empty `catch`
- Throw **domain/application errors** in core; map to Nest `HttpException` at presentation (filters)
- Use exception filters for consistent API error shapes
- Log unexpected errors once at the boundary with correlation context

## Don't

- Return raw Error objects / stack traces to clients
- Catch-all in services that converts every failure into `200` + `{ ok: false }`
- `HttpException` deep inside domain entities
