---
name: github-actions
description: Understand and extend the generated GitHub Actions CI workflow. Use when changing CI steps, adding jobs, caching, or deployment.
---

# GitHub Actions CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests. The steps were generated from the recipes chosen at scaffold time (lint, test, build, Docker image).

## Conventions

- Keep CI commands identical to the project scripts so "works locally" means "works in CI"; add new checks as scripts first, then call them from the workflow.
- Add caching once a lockfile is committed (`cache:` on `actions/setup-node`, or the setup action's equivalent).
- Pin third-party actions by major version (as generated) or by commit SHA for stricter supply-chain control.
- Put deployment in a separate workflow/job that depends on the CI job; never mix secrets into pull-request jobs from forks.
- `zealakit add github-actions` regenerates the workflow from the project's recipes if you start over.
