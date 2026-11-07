# Release checklist

Manual, repeatable process for publishing `zealakit` to npm.

## 1. Prepare

1. Bump `version` in `package.json` (semver; prerelease ids are supported).
2. Update README and release notes (or CHANGELOG if one is added) for user-visible changes.
3. Confirm the supported runtime requirements:
   - Node.js 22.12+ for the CLI
   - Nuxt template: Node.js 22.22+
   - Go templates: Go 1.22+
4. Run `pnpm install --frozen-lockfile` and commit the lockfile if dependencies changed.

## 2. Validate

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:scaffold
pnpm test:pack
pnpm test:integration
pnpm test:go
```

`test:go` skips cleanly when the Go toolchain is unavailable. `test:pack` and
`test:integration` install the packed tarball outside the workspace.

## 3. Inspect the artifact

```bash
pnpm pack --pack-destination /tmp/zealakit-release
tar -tvzf /tmp/zealakit-release/zealakit-*.tgz | head
```

Check:

- `dist/index.js` exists and is executable.
- `README.md`, `LICENSE`, `templates/`, and `recipes/` are present.
- `apps/`, `packages/`, `tests/`, `scripts/`, `monitor/` are absent.
- No `.cursor` symlinks or `node_modules` are packed.
- `package.json` `bin` points at `./dist/index.js`.
- No runtime dependency points at `workspace:*`.

## 4. Clean install

```bash
mkdir /tmp/zealakit-install && cd /tmp/zealakit-install
npm init -y
npm install /tmp/zealakit-release/zealakit-*.tgz
./node_modules/.bin/zealakit --version
./node_modules/.bin/zealakit info --json
./node_modules/.bin/zealakit create smoke -t vite-react -w biome -y
```

`pnpm test:integration` automates the same flow in a temporary directory.

## 5. Publish

```bash
pnpm release --dry-run     # full validation + npm publish dry run
pnpm release               # asks for confirmation; publishes and tags
```

The release script refuses dirty worktrees, already-used versions, and missing
npm authentication. It runs the validation suite unless `--skip-tests` is
explicitly passed.

After publishing:

```bash
git tag v<version>
git push origin v<version>
```
