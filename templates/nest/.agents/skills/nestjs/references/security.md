# Security

## Do

- AuthN/AuthZ via **guards**; keep controllers free of ad-hoc token parsing
- Validate **all** input with DTOs + `ValidationPipe` (whitelist / forbid non-whitelisted)
- JWT: short-lived access tokens, rotate secrets, never log tokens
- Rate-limit public/auth endpoints
- Treat output encoding / CSP as defense in depth for any HTML surfaces

## Don't

- Trust client-supplied roles/ids without server checks
- Return password hashes, tokens, or internal notes in DTOs
- Disable validation “temporarily” on write paths
