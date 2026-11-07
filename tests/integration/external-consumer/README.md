# External consumer fixture

This fixture behaves like an independent repository that installed `zealakit`
from a local tarball. It must not import `@zealakit/*` packages or read the
Zealakit workspace source.

## Run manually

From this directory:

```bash
# 1. Build + pack the CLI from the repository root
cd ../../..
pnpm build
pnpm pack --pack-destination tests/integration/external-consumer

# 2. Install the tarball as an external dependency
cd tests/integration/external-consumer
mv zealakit-*.tgz zealakit.tgz
pnpm install --ignore-workspace --ignore-scripts --prefer-offline

# 3. Run the consumer test
node consumer.mjs
```

`pnpm test:integration` automates the same flow in a temporary directory and
removes it afterwards.
