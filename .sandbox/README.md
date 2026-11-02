# Sandbox

Throwaway apps for trying the local CLI (`pnpm test:sandbox` or scaffold into this folder).

This directory is **not** part of the zealakit pnpm workspace:

- `.npmrc` → `ignore-workspace=true` (pnpm does not join the kit lockfile)
- `package.json` → local `packageManager` fence so Yarn classic / Corepack do not pick up the kit’s `pnpm@…` pin (that produced the misleading `yarn@pnpm@…` error)

Install inside `.sandbox/<app>` with any client:

```bash
cd .sandbox/my-app
npm install    # or: pnpm install | yarn | bun install
npm run dev
```
