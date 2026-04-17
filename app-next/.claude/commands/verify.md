---
description: Run the current PR's verification checks
argument-hint: [optional PR number for targeted verification]
---

Run the standard pre-merge verification for the current branch.

## Universal checks

```bash
cd app-next
pnpm install --frozen-lockfile
pnpm tsc
pnpm lint
pnpm build
```

If any fail, stop and report. Don't try to fix things without asking first — verification failures may point to real design issues.

## PR-specific checks

If the user provided a PR number ($1), read `@app-next/docs/ROADMAP.md`, find PR $1's entry, and run its "Verify:" steps. These often include manual smoke tests against a regtest `litd` — describe them to the user; don't try to spin up a backend yourself.

## Test suite (if tests exist)

```bash
cd app-next
pnpm test run
```

## Lockfile sanity

```bash
git status --short app-next/pnpm-lock.yaml
```

Lockfile should be committed if `package.json` changed. If it's dirty and `package.json` isn't, something ran npm/yarn by accident — flag it.

## Report

A 5-line summary:
- tsc: ✓/✗
- lint: ✓/✗
- build: ✓/✗ (and bundle size delta vs. rebuild)
- tests: ✓/✗ (coverage if applicable)
- lockfile: clean / needs commit
