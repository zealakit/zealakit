# Architecture

Project layout → [structure-ddd](../../structure-ddd/SKILL.md).

## Do

- One Nest feature module per bounded context (`bootstrap/modules/<feature>.module.ts`)
- Share via exported providers / shared modules — never circular `imports: []`
- Thin services: orchestration in application handlers; domain rules in domain
- Cross-feature work via ports or domain events — not direct handler/adapter imports
- Repository **ports** in domain/application; **adapters** only in infrastructure

## Don't

- Circular module graphs
- Fat “god” services that own unrelated use cases
- Controllers calling infrastructure adapters directly
- Leaking ORM entities across the HTTP boundary
