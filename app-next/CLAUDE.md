# CLAUDE.md — `app-next/` working rules

You are working on `app-next/`, a showcase rebuild of the lightning-terminal
frontend. Read `@app-next/docs/ROADMAP.md` for the full plan and
`@app/src/store/COMPLEXITY_GUIDE.md` for the original app's band-structured
complexity model. Both are canonical; don't restate them, just apply them.

This file is the standing rule set. Hold these rules mechanically.

---

## Thesis

Server state and client state are different things.
- **TanStack Query** owns server state (anything derived from an RPC).
- **Zustand** owns client state (auth session, wizard step, filter input).
- **`useStreamingQuery`** is the only seam where gRPC server-streams merge into
  the Query cache. Never subscribe to a stream elsewhere.

Treating them the same is the root cause of stale-data, race, and cross-store
coupling bugs in the legacy `app/`.

---

## Architecture invariants

Hold these as hard rules unless the ROADMAP explicitly suspends one for a PR.

1. **Every RPC goes through TanStack Query.** No ad-hoc `fetch`, no raw
   `await client.foo()` outside a `queryFn` / `mutationFn` / `useStreamingQuery`.
2. **Every server-stream goes through `useStreamingQuery`.** Merge events into
   the cache via a pure `merge(prev, event) => { next, invalidate[] }` reducer.
3. **Cross-feature coordination is cache invalidation, never an imperative
   cross-store call.** A mutation in feature A that affects feature B calls
   `queryClient.invalidateQueries({ queryKey: ['b', ...] })`. A `useStreamingQuery`
   merge fn returns `invalidate: [...queryKeys]` for the same purpose.
4. **Domain models are plain classes.** Hex-decoding, derived getters, validation
   live here. No reactivity libraries. Constructed by `queryFn`'s `select` or in
   the merge reducer.
5. **No manual `useMemo` / `useCallback`.** React Compiler (enabled in PR 27)
   handles memoization. Before PR 27 writing them is permitted only if a Profiler
   trace shows a concrete regression; note the justification in the PR body.
6. **Zod schemas at boundaries.** Every form uses React Hook Form + Zod. Every
   RPC response that a user-facing view depends on gets validated at the query
   level, not inside components.

---

## File layout

```
app-next/
  src/
    app/                    router, providers, error boundaries
    features/
      <feature>/            queries.ts, mutations.ts, store.ts (Zustand),
                            components, types, tests
    shared/
      api/                  connect-es transport + clients + interceptors
      hooks/                useStreamingQuery and other cross-feature hooks
      domain/               plain classes: Channel, Swap, Account, Order
      ui/                   shadcn primitives only
    strings.ts              centralized English strings (i18n-ready)
  e2e/                      Playwright specs + regtest bring-up
  docs/                     ROADMAP.md and pedagogical docs
```

Tests live next to the thing they test: `src/shared/domain/channel.test.ts`,
`src/features/swaps/useSwaps.test.ts`. E2E lives in `e2e/`.

---

## Coding conventions

- **TypeScript strict** with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Accept the friction; don't opt out.
- **Avoid `any`.** Prefer `unknown` + narrowing, or typed generics. The only
  legitimate `any` is at a third-party boundary that doesn't ship types.
- **Named exports.** No default exports from modules (except Vite entry and
  router routes where the framework requires them).
- **Path alias:** `@/*` → `./src/*`. Use for anything crossing feature folders.
- **No barrel files** (`index.ts` re-exports) in `features/` — reviewers should
  see the actual import paths. Barrels are fine in `shared/ui/` for shadcn
  primitives where consumers import by name.
- **Comments:** only write one when WHY is non-obvious. Don't narrate WHAT; the
  code and types already do that.

---

## Testing

- **Vitest** for unit + integration. Domain models: 100% coverage expected.
  `useStreamingQuery` and feature hooks: cover the merge fn and invalidation
  behavior against a mock Connect transport.
- **Playwright** for end-to-end. Each feature gets one happy-path spec that
  exercises a real regtest `litd`. Ordering guarantees and live-streaming are
  load-bearing; the E2E proves they hold.
- **Storybook** for `src/shared/ui/` primitives only. Feature components are
  exercised by tests + the real app; don't add stories for them.

A PR adding a new domain class or hook without tests is incomplete.

---

## Git rules

- **Long-lived branch:** `rebuild` (in the `Justinohallo/lightning-terminal` fork).
- **Feature branches:** `app-next/NN-kebab-description` branched from `rebuild`.
  The NN matches the ROADMAP's PR number. Use the literal `app-next/` prefix —
  this is the folder being worked on, and it does not collide with `rebuild`.
- **Commits:** Conventional Commits with the `(app-next)` scope:
  `feat(app-next): ...`, `fix(app-next): ...`, `test(app-next): ...`,
  `docs(app-next): ...`, `chore(app-next): ...`.
- **Merge strategy:** squash-merge feature branches into `rebuild`. Merge-commit
  when syncing `master` → `rebuild`.
- **Never touch `app/**`** on a feature branch. If you want to improve `app/`,
  make a separate branch off `master` and PR upstream. The permission settings
  enforce this; do not work around them.
- **Never force-push `rebuild`.** Feature branches are fine to rebase while in
  review.

---

## PR flow

For each PR:

1. `git checkout rebuild && git pull origin rebuild`
2. `git checkout -b app-next/NN-description`
3. Read the ROADMAP entry for PR NN. Implement exactly that scope.
4. Run `pnpm tsc && pnpm lint && pnpm build` locally. Fix failures.
5. Invoke the `band-reviewer` agent on the diff. Fix what it flags.
6. Hand off to the human for review.
7. After approval, push and open PR:
   `gh pr create --repo Justinohallo/lightning-terminal --base rebuild --head app-next/NN-description ...`
8. Squash-merge when approved.

When stacking PRs (next PR starts before previous merges), branch from the
previous feature branch instead of from `rebuild`. Note the dependency in the
PR body. Rebase the stacked branch when the parent lands.

---

## Package manager

**pnpm** (pinned via the `packageManager` field in `package.json`). Enable with
`corepack enable` if not installed. Don't use npm or yarn for install — the
lockfile is `pnpm-lock.yaml` and mixing managers causes drift.

---

## What this file is NOT

- Not a substitute for reading the ROADMAP. This file holds the invariants that
  apply across all PRs; the ROADMAP holds the scope of each PR.
- Not a place for feature-specific notes. Those go in the feature folder, close
  to the code.
- Not a style guide. See Prettier + ESLint configs (landed in PR 2) for
  mechanical style; this file is about architecture and process.
