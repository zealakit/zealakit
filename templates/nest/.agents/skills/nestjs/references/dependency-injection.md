# Dependency Injection

## Do

- **Constructor injection only** for application/domain collaborators
- Bind domain ports with **injection tokens** (`Symbol.for(...)`) in feature modules
- Prefer `providedIn` / module `providers` that are explicit and testable
- Keep default scope (`SINGLETON`) unless request-scoped state is required
- Honor ISP/LSP: narrow ports; substitutable adapters

## Don't

- Service locator (`ModuleRef.get` / global containers) in business code
- Optional constructor deps that hide required collaborators
- Request-scoped providers unless you need per-request state (and understand the tree)
- Concrete infrastructure types in domain constructors
