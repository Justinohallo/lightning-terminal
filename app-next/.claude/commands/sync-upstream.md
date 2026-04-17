---
description: Sync fork master with upstream, then merge into rebuild
---

Keep the fork current with `lightninglabs/lightning-terminal`. Run weekly, or whenever upstream bumps proto versions in `go.mod` (conflicts there are expected and desirable — the next `pnpm gen` will regenerate).

## Step 1 — Check working tree

```bash
git status --short
git branch --show-current
```

Must be on any branch other than `master` with a clean working tree. If the tree is dirty, stash or tell the user; don't silently absorb changes.

## Step 2 — Fetch + fast-forward master

```bash
git fetch upstream
git checkout master
git merge --ff-only upstream/master
```

Fast-forward only — if it fails, master has diverged from upstream and the user has to resolve manually.

## Step 3 — Push master (user confirms)

```bash
git push origin master
```

Ask the user before pushing. Master on the fork should always be a verbatim mirror of upstream.

## Step 4 — Merge master into rebuild

```bash
git checkout rebuild
git merge master
```

**Merge commit, not rebase** — preserves the "picked up upstream checkpoint X" marker in `rebuild`'s history.

Resolve any conflicts. Realistic conflict points: `go.mod` version bumps (these flow through to the next `pnpm gen`).

## Step 5 — Push rebuild (user confirms)

```bash
git push origin rebuild
```

## Step 6 — Notify

Report to the user:
- The SHA range that was pulled in.
- Any conflicts resolved and how.
- Whether `pnpm gen` needs to run as a follow-up (check `git diff master~1 master -- go.mod`).
