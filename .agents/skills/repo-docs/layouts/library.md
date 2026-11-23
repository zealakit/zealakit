---
layout: library
required:
  - Install
  - Quick start
  - API
  - Compatibility
  - License
recipeSections: []
---

# Library layout

Reusable package: component library, kernel, adapter or shared module.

1. **H1** — package name; tagline states what it provides and its runtime.
2. **Install** — package manager commands and peer dependencies.
3. **Quick start** — the smallest working example, complete and runnable.
4. **API** — one H3 per exported entry point, in the same order as the public
   entry file. Each H3: signature block, parameter table, return value, one
   example. This is the reference; the README is not a tutorial.
5. **Compatibility** — supported runtimes/frameworks, peer dependency ranges,
   ESM/CJS notes.
6. **License**.

If the repository ships several public packages, use `layouts/monorepo.md` for
the root and this layout for each package README.
