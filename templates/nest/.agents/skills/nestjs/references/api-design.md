# API Design

## Do

- Request/response **DTOs** at the edge — never return ORM entities raw
- Pipes for transform/validate; interceptors for cross-cutting serialization/logging
- Version breaking changes (`URI` or header versioning — pick one and stay consistent)
- Stable error payload shape (status, code, message, details)

## Don't

- Manual object spreads that forget to strip secrets
- Business rules inside interceptors/pipes
- Unversioned breaking JSON field renames on public clients
