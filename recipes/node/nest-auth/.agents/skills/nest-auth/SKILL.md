---
name: nest-auth
description: Authenticate Nest routes with JWT bearer tokens. Use when protecting endpoints, changing token settings, or replacing the demo user store.
---

# Nest auth (JWT)

## What is wired

- `POST /api/v1/auth/login` → `{ accessToken }` for a valid email/password.
- `GET /api/v1/auth/me` — example route protected by `JwtAuthGuard`.
- `AuthModule` (in `src/bootstrap/modules/auth.module.ts`) is imported by `AppModule` and exports `AuthService` and `JwtAuthGuard`.

## Conventions

- Protect a route with `@UseGuards(JwtAuthGuard)` (import `AuthModule` in the module that owns the controller). The verified payload is `request.user` (`sub`, `email`).
- Set `JWT_SECRET` in every non-local environment. The built-in fallback is for development only.
- `AuthService` keeps a demo in-memory user (`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`). Replace `users` with a repository port and keep password hashing (`bcryptjs`).
- Keep tokens short-lived (`expiresIn`); add refresh tokens as a separate endpoint if needed.
- This recipe uses `@nestjs/jwt` directly rather than Passport: the template runs on Nest's native Node adapter, so the guard reads the `Authorization` header itself.
