# Lightning Terminal Frontend Rebuild — `app-next/`

> **Canonical location.** This document is the living roadmap for the rebuild.
> It lives at `app-next/docs/ROADMAP.md` and is referenced by `app-next/CLAUDE.md`.
> Edits happen here, not elsewhere.

## Context

The current `app/` is a solid 2021-era React app: CRA v5, React 17, MobX (12 domain stores + 14 view-model stores), Emotion, `@improbable-eng/grpc-web`, React Router v6, zero tests committed, 14% Storybook coverage, single i18n locale. Nothing is broken. The point of this rebuild is that every layer of that stack has been superseded by something that **teaches a clearer idea** — and we want to make that clarity legible as an open-source demo.

**Outcome we want:** a sibling `app-next/` folder that a reviewer can clone, point at a regtest `litd`, and learn from by reading the PR history. Each PR teaches one thing. The README walks through the keystone decisions with before/after diffs against `app/`.

**The thesis in one sentence:** server state and client state are different things, and treating them the same is the root cause of most stale-data, race, and coupled-store bugs in this codebase.

---

## Non-goals

- **Not a drop-in replacement for `app/`.** No byte-equivalent behavior, no guaranteed feature parity.
- **Not production.** No mainnet QA, no Lightning Labs release process, no accessibility audit beyond what Radix gives us.
- **Not a PR to upstream `master`.** All work lands in *your fork's* long-lived `rebuild` branch. Upstream `master` stays a clean mirror of `lightninglabs/lightning-terminal:master` so you can keep contributing there independently. `app/` continues to ship inside `litd` via `//go:embed app/build/*` upstream; `app-next/` builds to its own `dist/` and is served by `vite preview` / `npx serve` for review.
- **Not a litd protocol change.** Same gRPC surface, same Basic-auth scheme, same proxy target.
- **Not a brand/design-system contribution.** shadcn primitives copied locally, styled to be clean, not pixel-matched to Lightning Labs brand.

---

## Locked decisions (confirmed with user)

| Decision | Choice |
|---|---|
| Repo location | **Sibling folder `app-next/` in this repo.** Shared `go.mod` proto-version source; side-by-side `git diff` is the teaching artifact. |
| Git model | **Fork with long-lived `rebuild` branch.** Fork master mirrors upstream; feature PRs target `rebuild` inside the fork, named `app-next/NN-description`. Full mechanics in the Git workflow section below. |
| Package manager | **pnpm** (pinned via `packageManager` field in `package.json`). Chosen over yarn 1 because yarn 1 errors on any un-interpolated env var in `~/.npmrc`; pnpm warns and continues. |
| Build workflow | **Agentic — Claude Code is the primary implementer.** Each PR is a focused Claude Code session against `CLAUDE.md` + this plan. Human owns review and pattern enforcement. No agents shipped in the app itself. Full mechanics in the Agentic development workflow section below. |
| Pool scope | **Include:** list, single order submit (partial-failure lesson), batches polling. |
| Sidecar & custom session | **Include.** |
| Onboarding tour | **Include** — rebuilt as Zustand-driven state machine over Radix Popover. |
| E2E | **Real regtest harness.** Playwright against scripted `bitcoind + litd + peer` bring-up. |
| React Compiler | **Adopt** (PR 27, after features land). |

---

## Target stack

| Layer | Choice | Replaces |
|---|---|---|
| Build | Vite 5 | CRA / react-scripts |
| Language | React 19 + TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | React 17 |
| Memoization | React Compiler | manual `useMemo`/`useCallback`, MobX `observer` |
| Codegen | `buf` + `protoc-gen-es` + `protoc-gen-connect-es` | `app/scripts/build-protos.js` + `ts-protoc-gen` + `[jstype=JS_STRING]` patch |
| RPC client | `@connectrpc/connect-web` (gRPC-Web mode to keep litd unchanged) | `@improbable-eng/grpc-web` |
| Server state | `@tanstack/react-query` | MobX observable maps + `storage.getCached` |
| Streaming | Custom `useStreamingQuery` hook (pure-reducer merge into Query cache) | `onChannelEvent` / `onSwapUpdate` imperative handlers |
| Client state | Zustand (auth, wizard steps, filters, tour) | MobX view stores |
| Forms | React Hook Form + Zod | MobX view stores |
| Styling | Tailwind + Radix primitives + shadcn/ui | Emotion + rc-* grab-bag |
| Router | TanStack Router (typed routes, loaders) | React Router v6 + `unstable_HistoryRouter` |
| Tests | Vitest (unit), Playwright (E2E), MSW/mock-transport for hook tests | Jest installed but never used |
| Errors | ErrorBoundary per route + Sentry behind `VITE_SENTRY_DSN` env flag | Toast + `appView.handleError` |

---

## Repo structure

```
app-next/
  package.json              # independent; no yarn workspace
  vite.config.ts
  buf.gen.yaml              # buf codegen config; output to src/gen/
  index.html
  src/
    app/                    # router, providers, ErrorBoundary
    features/
      auth/
      channels/
      accounts/
      orders/
      batches/
      swaps/
      sessions/
      node/
      settings/
      tour/
    shared/
      api/                  # connect-es transport, clients, auth interceptor
      hooks/                # useStreamingQuery, useAuthedQuery
      domain/               # Channel, Swap, Account, Order (plain classes)
      ui/                   # shadcn primitives (Button, Dialog, Table, etc.)
    gen/                    # buf output — committed in PR 3, gitignored in follow-up
    strings.ts              # centralized English strings (i18n-ready)
  e2e/                      # Playwright specs + regtest bring-up scripts
  README.md
```

---

## Git workflow

**Model:** fork `lightninglabs/lightning-terminal` into your own account. In the fork, `master` tracks upstream verbatim — never modified directly. All rebuild work lives on a long-lived `rebuild` branch. Feature PRs within the fork target `rebuild`, not `master`.

**Naming note:** the long-lived branch is called `rebuild` (not `app-next`) because git's ref namespace can't hold both a branch at `refs/heads/app-next` and sub-paths at `refs/heads/app-next/NN-...`. Using `rebuild` as the base lets feature branches live under `app-next/NN-description` without collision. The `app-next/` folder inside the repo keeps its original name.

This keeps two concerns fully decoupled:
1. Your ability to contribute upstream (branch off `master`, PR to `lightninglabs/lightning-terminal:master`) continues normally.
2. The showcase rebuild (branch off `rebuild`, PR within your fork) proceeds in parallel without polluting upstream or your clean master mirror.

**Branch topology in the fork:**

```
origin/master       ← tracks upstream/master (lightninglabs/lightning-terminal)
   │
   └── rebuild      ← long-lived showcase branch, created from master at day zero
         ├── app-next/01-scaffold-vite       (squash-merged)
         ├── app-next/02-eslint-tailwind     (squash-merged)
         ├── app-next/03-codegen             (open PR, targets rebuild)
         └── ...
```

**Remotes:**
```
upstream = lightninglabs/lightning-terminal   (read-only reference for syncing)
origin   = justinohalloran/lightning-terminal (your fork — push target)
```

**Branch naming:** `app-next/NN-kebab-description` branched off `rebuild` (e.g. `app-next/03-codegen-connect-es`). Numeric prefix mirrors the PR number in this plan and makes branches sort naturally.

**Commit convention:** Conventional Commits, scoped to `app-next`:
```
feat(app-next): scaffold vite + react 19 + ts strict
feat(app-next): buf + connect-es codegen
feat(app-next): useStreamingQuery hook for cache-aware merges
test(app-next): vitest coverage for domain + hooks
docs(app-next): architecture diagram + before/after diffs
```
The scope makes it obvious to any future reader / bisector that a commit cannot have touched the production `app/`.

**Merge strategy into `rebuild`:**
- **Feature branches (`app-next/NN-...` → `rebuild`):** squash-merge. One commit per lesson. `git log --oneline rebuild` reads as the roadmap narrative.
- **Upstream sync (`master` → `rebuild`):** merge commit (no rebase). Preserves upstream history and makes each "picked up upstream checkpoint X" moment legible in the branch log.

**Keeping `rebuild` current with upstream:**
```bash
# run weekly, or whenever upstream bumps proto versions in go.mod
git fetch upstream
git checkout master && git merge --ff-only upstream/master && git push origin master
git checkout rebuild && git merge master && git push origin rebuild
```
Conflicts should be rare because `app-next/` is an isolated folder. The realistic conflict is `go.mod` version bumps — which is actually desirable: upstream's new LND/Loop proto versions flow into the rebuild, and the next `pnpm gen` regenerates against them.

**Upstream contribution flow (independent):**
```bash
git checkout master && git checkout -b fix/something
# ... make changes under app/ or elsewhere (never app-next/) ...
git push origin fix/something
# open PR from Justinohallo:fix/something → lightninglabs:master
```
No coupling to `rebuild`. You can do this any day, even mid-rebuild.

**Tags:** after each phase closes on `rebuild`, tag: `rebuild/phase-a-complete`, `rebuild/phase-b-complete`, etc. Lets a reviewer check out the exact state at each teaching milestone. Final showcase tag: `rebuild/v1.0-showcase-complete` after PR 31.

**Tracking issue:** pinned in your fork (not upstream) — a single issue listing all 31 PRs as checkboxes, each linked to its PR when opened. PR bodies link back to the tracking issue.

**Day-zero setup (before PR 1):**
```bash
# one-time, before opening any PR
git clone git@github.com:Justinohallo/lightning-terminal.git
cd lightning-terminal
git remote add upstream https://github.com/lightninglabs/lightning-terminal.git
git fetch upstream
git checkout -b rebuild   # from master
git push -u origin rebuild
```
Now `rebuild` is a real branch on day one. Every feature PR branches from it.

**CODEOWNERS:** unnecessary — it's your fork; you own everything. No separation rule needed.

**Showcase visibility:**
- Fork's README gains a top-of-file signpost: *"Personal showcase rebuild of lightning-terminal's frontend — see the `rebuild` branch (with features merged from `app-next/NN-*`) for the full story."*
- Pinned tracking issue in the fork.
- Optional GitHub Pages action that builds `app-next` on every push and deploys the static bundle (with a "demo mode" flag that serves canned data when no `litd` is reachable).
- If upstream ever expresses interest: a single squash-against-`upstream/master` PR becomes the "offer" — or leave `rebuild` as a reference branch they can browse. Fork-branch model keeps both doors open.

**Force-push etiquette:** force-push your feature branch freely while in review (to keep it rebased on `rebuild`). Do **not** force-push after an approval without flagging it — reviewers lose their context. Never force-push `rebuild` itself.

**What never happens:**
- `app-next/` code on upstream `master` (fork or upstream).
- `app/` changes on feature branches targeting `rebuild`. If you want to improve `app/`, that's a separate branch off `master` → upstream PR.
- Cherry-picking between `master` and `rebuild`. Sync only flows one direction: `upstream/master → origin/master → rebuild`.

---

## Agentic development workflow

This rebuild is built primarily with **Claude Code**. The repo is structured so the coding agent can do most of the implementation work while the human focuses on design review and pattern enforcement. This is itself part of the showcase: *how do you structure a codebase so a coding agent can contribute high-quality PRs to it?*

No agent code ships to users — the app stays a pure state-management showcase. Everything here is development-time tooling, all landing in the new PR 1.5 below.

**Core artifacts:**

**`app-next/CLAUDE.md`** — the persistent spec Claude reads at the start of every session. Written as rules the agent can apply mechanically, not prose:
- The thesis: server state ≠ client state. TanStack Query owns server state; Zustand owns client state.
- Architecture invariants: every RPC goes through TanStack Query; every stream goes through `useStreamingQuery`; cross-feature coordination is cache invalidation, never an imperative call; no manual `useMemo`/`useCallback` after PR 27.
- File layout (`features/X/`, `shared/domain/`, `shared/hooks/`, `shared/ui/`), where tests live.
- Coding conventions (TS strict flags, Zod schemas at boundaries, domain models are plain classes with derived getters).
- Git rules (target `rebuild`, feature branches `app-next/NN-description`, scope `(app-next)` in Conventional Commits, never touch `app/**`).
- Testing expectations (Vitest for domain + hooks, Playwright for E2E, mock Connect transport for integration).
- Pointers to the plan file and `app/src/store/COMPLEXITY_GUIDE.md`.

**`.claude/settings.json`** — scoped permissions, committed to the repo so reviewers can reproduce:
- `permissions.allow`: `Bash(pnpm *)`, `Bash(git status)`, `Bash(git diff *)`, `Bash(git log *)`, `Bash(git checkout *)`, `Bash(git branch *)`, `Bash(buf *)`, `Bash(npx playwright *)`, read/write on `app-next/**`.
- `permissions.ask`: `Bash(git push *)`, `Bash(git merge *)`, `Bash(git commit *)`, `Bash(gh pr create *)` — the agent confirms before any shared-state action.
- `permissions.deny`: writes to `app/**`, writes outside `app-next/` + `.github/` + `.claude/`.

**`.claude/commands/`** — custom slash commands for recurring flows:
- `/pr <NN>` — reads the plan, branches `app-next/NN-description` from `app-next`, scaffolds the feature skeleton for that PR, implements the scope.
- `/sync-upstream` — runs the `fetch upstream → merge into master → merge into app-next` flow with confirmations at each push.
- `/verify <NN>` — runs the PR's inline verification steps (`pnpm tsc && pnpm lint && pnpm test` plus any manual smoke described in the plan).
- `/prep-merge` — drafts the squash-commit message from the feature branch's commits, following Conventional Commits.

**`.claude/agents/`** — specialized sub-agents invoked via the `Agent` tool:
- `band-reviewer` — reads the diff + this plan + `COMPLEXITY_GUIDE.md` and flags pattern violations (cross-store imperative calls, `useMemo` creeping back post-PR-27, streams that bypass `useStreamingQuery`, mutations that don't invalidate the right keys). Invoked before every PR is opened.
- `test-writer` — when a new domain model or hook lands, drafts Vitest cases for it.
- `story-writer` — when a new `shared/ui/` primitive lands, drafts its Storybook story.

**`.claude/hooks/`** — quiet safety nets, not gates:
- `PostToolUse` on `Edit`/`Write`: runs `pnpm tsc --noEmit` scoped to the edited feature folder; reports errors back to Claude inline.
- `PreToolUse` on `Bash(git commit *)`: runs `pnpm lint && pnpm tsc` as a final check.

**Session cadence for each PR:**

1. `git checkout rebuild && git pull origin rebuild && git checkout -b app-next/NN-description`
2. Fresh Claude Code session in the repo.
3. `/pr NN` — Claude reads the plan's PR entry and begins implementation.
4. Hooks enforce type-check + lint on every file edit.
5. Before opening the PR, invoke `band-reviewer` on the diff; Claude fixes flagged violations.
6. Human reviews the final diff + the band-reviewer's report.
7. `/prep-merge` drafts the squash message; human opens the PR via `gh pr create --repo Justinohallo/lightning-terminal --base rebuild`; squash-merge.

**What this workflow is NOT:**
- NOT shipped to users. No `@anthropic-ai/*` deps in `app-next/package.json`. The app itself is agent-free per the locked decision.
- NOT a dev-tooling CLI for downstream consumers (no `yarn scaffold:feature`). All agent infrastructure is development-time.
- NOT an excuse for lower code quality. The human remains the gatekeeper; Claude is the implementer. Every PR still gets human review before merge.

**Optional MCP servers** (not required for the core flow):
- **GitHub MCP** — open/review PRs from inside Claude Code without context-switching to a browser.
- Filesystem MCP is the default and already present.

**Showcase payoff in the README (PR 31):**
- A "Built with Claude Code" section walking through one PR's session end-to-end (recommended: PR 10, the `useStreamingQuery` hook — richest pedagogical diff).
- Links to `CLAUDE.md`, the `.claude/commands/`, and the sub-agent configs so reviewers can fork and reproduce.
- Short screencast of `/pr 10` executing, including the `band-reviewer` catch and fix.

---

## Keystone PRs

Four PRs carry disproportionate risk-or-reward. If these land cleanly, the rest is mechanical.

1. **PR 3** — buf + Connect-ES codegen. The fulcrum for typed RPC.
2. **PR 4** — Connect-ES transport + auth interceptor. The one place gRPC plumbing lives.
3. **PR 10** — `useStreamingQuery` hook. The intellectual center of the rebuild.
4. **PR 13** — First end-to-end feature (Accounts) with query + mutation + cross-key invalidation. The template every later feature copies.

---

## PR roadmap

Target: each PR reviewable in 30–60 minutes. Numbers are sequential; dependencies called out per PR.

### Phase A — Foundations

**PR 1 — Scaffold Vite + React 19 + TS strict + minimal CI** — S ✅ *merged*
- `app-next/package.json`, `vite.config.ts`, `tsconfig.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), Vite proxy to `https://localhost:8443`, README signpost.
- `.github/workflows/app-next.yml` scoped to `push` / `pull_request` with `paths: ['app-next/**']`, target branch `rebuild`. Jobs: install, `pnpm tsc`, `pnpm build`. Adds `pnpm lint` in PR 2, `pnpm test` in PR 23, `pnpm e2e` in PR 30.
- Verify: `pnpm dev` boots, `pnpm tsc` clean, PR into `rebuild` shows green CI.

**PR 1.5 — Agent infrastructure (`CLAUDE.md` + `.claude/`)** — S
- `app-next/CLAUDE.md` with the invariants + conventions + pointers specified in the Agentic development workflow section.
- `.claude/settings.json` with scoped allow/ask/deny permissions (committed so reviewers can reproduce).
- `.claude/commands/` for `/pr`, `/sync-upstream`, `/verify`, `/prep-merge`.
- `.claude/agents/` with `band-reviewer`, `test-writer`, `story-writer` sub-agent definitions.
- `.claude/hooks/` for `yarn tsc` post-edit and `yarn lint && yarn tsc` pre-commit safety nets.
- Deps: PR 1. Verify: open a fresh Claude Code session in the fork, invoke `/pr 2`, confirm it drafts the PR 2 ESLint + Tailwind + shadcn scaffold correctly against `CLAUDE.md` conventions before any real code lands in PR 2.
- **Teaching note:** every subsequent PR is developed through this infrastructure. This PR is the "Built with Claude Code" foundation the README (PR 31) shows off.

**PR 2 — ESLint 9 flat config + Prettier + Tailwind + shadcn baseline** — S
- `eslint.config.js`, `tailwind.config.ts` with design tokens, `src/shared/ui/button.tsx` + `input.tsx` via `npx shadcn@latest add`. Lucide icons. Prettier with `prettier-plugin-tailwindcss`.
- Deps: PR 1. Verify: `yarn lint` clean; styled Button renders.

**PR 3 — `buf` + Connect-ES codegen (KEYSTONE)** — M
- `buf.gen.yaml`, `buf.yaml`, `scripts/gen.mjs` that downloads `.proto` files via the existing `app/scripts/build-protos.js` version-resolution logic (refactored to drop the `[jstype=JS_STRING]` patch — Connect-ES emits `bigint` natively). Output to `src/gen/`. Commit generated code on first pass.
- Deps: PR 1. Verify: `yarn gen` produces `src/gen/lnrpc/lightning_pb.ts` + `lightning_connect.ts`; import from a throwaway test file, `yarn tsc` clean.
- **Teaching note in README:** uint64s are now `bigint` on the wire.

**PR 3.5 — Gitignore `src/gen/` + codegen reproducibility check** — S *(lands after PR 4 stabilizes the transport)*
- Add `src/gen/**` to `app-next/.gitignore`. Remove the tracked generated files in the same commit.
- Extend the CI workflow: run `yarn gen` and fail if `git status --porcelain src/gen` is non-empty — proves codegen is deterministic and every downstream PR picks up the correct output locally.
- Deps: PR 3, PR 4. Verify: clean clone → `yarn gen && yarn tsc` green; CI fails if someone tweaks a `.proto` without committing regen'd output.

**PR 4 — Connect-ES transport + auth interceptor (KEYSTONE)** — S
- `src/shared/api/transport.ts` (`createTransport`, reads auth from store), `src/shared/api/clients.ts` (typed `lightningClient`, `swapClient`, `traderClient`, `litAccountsClient`, `litSessionsClient`, `litStatusClient`), error mapper `Code.Unauthenticated → AuthError`.
- Deps: PR 3. Verify: throwaway `Ping` page calls `getInfo({})` against regtest, renders alias.

**PR 5 — TanStack Query provider + first `useNodeInfo` query** — S
- `@tanstack/react-query` + devtools, `src/app/providers.tsx`, `src/features/node/useNodeInfo.ts`.
- Deps: PR 4. Verify: home page shows node alias + block height; query visible in devtools.

**PR 6 — Zustand auth store + login page (happy path)** — M
- `src/features/auth/store.ts` (Zustand, persisted to `sessionStorage`), `LoginPage.tsx` with RHF + Zod. Probe via `getInfo`. Basic error handling only.
- Deps: PR 5. Verify: login against regtest, land on home; bad password → inline error.

**PR 7 — TanStack Router + Layout shell + route tree** — M
- Route tree: `/`, `/home`, `/loop`, `/history`, `/pool`, `/settings`, `/connect`, `/connect/custom`. Root `beforeLoad` redirect for unauthed users. Layout with top nav.
- Deps: PR 6. Verify: nav through all routes; unauthed bounces; browser back button behaves.

### Phase B — The Keystone

**PR 8 — Port `Channel` domain model, strip MobX** — S
- `src/shared/domain/channel.ts` with hex-decoding + derived getters as plain methods. First Vitest tests in the repo.
- Deps: PR 7. Verify: `yarn test` green.

**PR 9 — `useChannels` query (Band 1)** — M
- `src/features/channels/useChannels.ts` combining `listChannels` + `pendingChannels` into `Channel[]`. Shadcn Table on `/home`.
- Deps: PR 8. Verify: regtest channel appears; close → moves to pending on refetch.

**PR 10 — `useStreamingQuery` hook (KEYSTONE)** — L
- `src/shared/hooks/useStreamingQuery.ts`:
  ```ts
  function useStreamingQuery<TData, TEvent>(opts: {
    queryKey: QueryKey;
    initialFetch: () => Promise<TData>;
    stream: (signal: AbortSignal) => AsyncIterable<TEvent>;
    merge: (prev: TData | undefined, event: TEvent) => { next: TData; invalidate?: QueryKey[] };
  }): UseQueryResult<TData> & { isStreamConnected: boolean };
  ```
- Initial-fetch via `useQuery`, stream via `useEffect` with `AbortController`, `queryClient.setQueryData` on each event, `invalidateQueries` for returned keys. Exponential backoff on stream drop (capped 30s).
- Deps: PR 9. Verify: unit tests with mock async-iterable transport — no real litd needed.

### Phase C — Applying the keystone

**PR 11 — Channel events via `useStreamingQuery`** — M
- Extend `useChannels` with `subscribeChannelEvents`. Merge fn ports the Band 6 cases from `channelStore.onChannelEvent`. "● live" stream-status pill.
- Deps: PR 10. Verify: `lncli openchannel` from peer → appears live; close → disappears live.

**PR 12 — Transactions stream + wallet balances** — M
- `useWalletBalance` query (`walletBalance` + `channelBalance`), `useTransactions` via `useStreamingQuery` on `subscribeTransactions`. **Merge fn returns `invalidate: [['wallet','balance']]`** — the pattern that replaces `nodeStore.onTransaction → fetchBalances()`.
- Deps: PR 11. Verify: regtest send → balance updates without refresh.

**PR 13 — Accounts feature (Band 3, KEYSTONE template)** — L *(split 13a list / 13b mutations if needed)*
- `src/shared/domain/account.ts`, `useAccounts` query, `useDepositMutation` / `useWithdrawMutation` / `useCloseAccountMutation` each with `onSuccess: invalidateQueries(['accounts'])`. `AccountList`, `AccountRow`, `DepositDialog`.
- Deps: PR 10. Verify: create/deposit/close against regtest Pool account.

**PR 14 — Auth: full error translation + session rehydrate (Band 2)** — M
- Port `authStore.getErrMsg` cross-subserver probe: on `Unauthenticated`, call `litStatusClient.subServerStatus` to produce `lndDetail`/`litDetail` messages. Rehydrate effect in `providers.tsx`: probe on mount, clear creds silently on failure.
- Deps: PR 6, PR 13. Verify: locked wallet → "wallet is locked" message; refresh with valid/stale creds behaves correctly.

**PR 15 — Orders list (Pool, read-only)** — M
- `src/shared/domain/order.ts`, `useOrders` query, `OrderList.tsx` with shadcn Table + filters. Filter state in Zustand (demonstrates the client-state/server-state split). Route: `/pool`.
- Deps: PR 13.

**PR 16 — Order submission (Band 4 — partial failure)** — M
- `OrderForm.tsx` (RHF + Zod, BID/ASK tabs). `useSubmitOrderMutation` — on success, inspect `response.invalidOrder`; if present throw `OrderValidationError` for RHF field-level surfacing. On true success invalidate **both** `['orders']` and `['accounts']`.
- Deps: PR 15. Verify: invalid order → inline validation; valid → list updates and account balance drops.

**PR 17 — Sessions (LiT): list + create wizard + revoke** — M
- `src/features/sessions/`. List query, create mutation (RHF wizard: type → expiry → permissions), revoke mutation. Route: `/connect`. Connection string displayed as text (QR deferred to PR 22).
- Deps: PR 13.

### Phase D — Harder complexity

**PR 18 — Batches with `refetchInterval` (Band 5)** — S
- `useBatches` with `refetchInterval: 60_000, refetchIntervalInBackground: false`. `BatchList.tsx`. `lastUpdated` becomes `query.dataUpdatedAt` for free.
- Deps: PR 15. Verify: requests every 60s while mounted; stop when navigating away; resume on return.
- **Teaching note:** the whole Band 5 polling-lifecycle complexity evaporates.

**PR 19 — Swap history + `Monitor` stream (Band 6)** — M
- `src/shared/domain/swap.ts`, `useSwaps` with `useStreamingQuery` over `ListSwaps` + `Monitor`. Merge fn implements the **"ignore FAILED after SUCCESS" ordering rule** (port from `swapStore.onSwapUpdate`). `SwapHistory.tsx`. Route: `/history`.
- Deps: PR 11. Verify: `loop out` via CLI; state transitions visible live.

**PR 20 — Swap wizard: inputs + quote (Band 7)** — L *(split 20a shell / 20b quote if needed)*
- `src/features/swaps/wizard/store.ts` (Zustand: step, direction, amount, channels). `BuildSwapWizard.tsx` three-step flow (direction → channels → review). `useQuote()` keyed on inputs, debounced. Back/cancel = `reset()`.
- Deps: PR 19.

**PR 21 — Swap wizard: execute + abort delay (Band 8 — complexity peak)** — L
- `requestSwap` mutation. `SWAP_ABORT_DELAY` as 3s countdown with `AbortController` tying timer + downstream RPC. Success invalidates `['swaps']` + `['channels']` + `['wallet','balance']` + `['accounts']`. Regtest vs. mainnet branch on `swapPublicationDeadline`. `swapId → chanIds` map in a Zustand slice keyed off mutation return.
- Deps: PR 20. Verify: undo during 3s window → no RPC fired; completion → history row appears + balances update live.

**PR 22 — Sidecar registration + custom-session page + QR codes** — M
- `CustomSessionPage.tsx`, `SidecarRegistration.tsx`. QR via `qrcode` lib. Retrofit QR rendering into PR 17's session detail view.
- Deps: PR 17.

### Phase E — Polish, observability, showcase

**PR 23 — Vitest coverage for domain + hooks** — M
- Tests for `Channel`, `Swap`, `Account`, `Order`. Tests for `useStreamingQuery` with mock async-iterables. CI coverage threshold: 70% on `src/shared/`.
- Deps: PR 21.

**PR 24 — Playwright E2E: login + channels + swap** — L
- `e2e/setup/regtest.sh` brings up `bitcoind + litd + loopd + poold + peer` with a pre-funded channel. Specs: `auth`, `channels`, `swap`. CI workflow `.github/workflows/e2e.yml`.
- Deps: PR 23.

**PR 25 — Storybook 8 for shared UI primitives only** — M *(parallelizable — any time after PR 2)*
- Stories for `src/shared/ui/*` (Button, Input, Select, Dialog, Table, DataTable, Toast). **Not feature components** — the old app's 14% feature-coverage was accidental complexity.
- Deps: PR 2.

**PR 26 — Error boundary per route + Sentry behind env flag** — S
- `src/app/ErrorBoundary.tsx` at route-level. Sentry init gated on `VITE_SENTRY_DSN`. `QueryClient` global `onError` → Sentry (if enabled) + toast (always).
- Deps: PR 21.

**PR 27 — Turn React Compiler on (KEYSTONE optional)** — S–M
- `babel-plugin-react-compiler` in Vite config + `eslint-plugin-react-compiler`. Fix any surfaced violations. README note: no manual memoization in this codebase.
- Deps: all features. Verify: smoke test full app; Profiler shows no regressions; grep for `useMemo`/`useCallback` near-zero.

**PR 28 — Settings page + theme toggle + unit toggle** — M
- `src/features/settings/`. Tailwind `dark:` + Radix theme. Sat/BTC unit toggle via Zustand + `useSatsFormat` hook. Clear-session button.
- Deps: PR 7.

**PR 29 — Onboarding tour (Zustand state machine over Radix Popover)** — M
- Replaces Reactour. `src/features/tour/store.ts` (step machine), `<TourStep id="…">` component wrapping Radix Popover, `useTour()` hook. Ties into existing `settingsStore.tourState` concept for "seen" persistence.
- Deps: PR 28.
- **Teaching note:** shows Zustand used as a state machine, not just a kv store.

**PR 30 — Add Playwright E2E to existing CI** — S
- Extend `.github/workflows/app-next.yml` (introduced in PR 1) with an `e2e` job that runs `e2e/setup/regtest.sh` and `yarn e2e` in a matrix. Cache browser binaries; upload Playwright traces on failure.
- Deps: PR 24.

**PR 31 — README polish + architecture diagram + "Built with Claude Code" section + screencast** — M
- `app-next/README.md` with architecture diagram, "what this demonstrates" section, three annotated before/after diffs against `app/` (channelStore → useChannels, authStore → LoginPage, swapStore.onSwapUpdate → useStreamingQuery).
- "Built with Claude Code" section: walks through a single PR's session end-to-end (recommended: PR 10, the streaming hook). Links to `CLAUDE.md`, `.claude/commands/`, and the sub-agent configs. Notes the scoped-permissions model and the `band-reviewer` safety net.
- Embedded screencast: `/pr 10` from blank branch to passing tests, including a `band-reviewer` catch + fix cycle.
- Deps: everything.

---

## Sequencing rationale

**Frontloaded (high-risk, resolve early):**
- PR 3 (codegen), PR 4 (transport), PR 10 (streaming hook) — everything downstream assumes these work.
- PR 6 (auth happy path) — feature PRs below it all require login.

**Bands follow the existing `COMPLEXITY_GUIDE.md`:** PR 9 (1) → PR 14 (2) → PR 13 (3) → PR 13/16 (4) → PR 18 (5) → PR 11/12/19 (6) → PR 20/21 (7/8). A reviewer gets one new complexity at a time.

**Each PR ships something visible.** No "3 weeks of plumbing with nothing on screen" anti-pattern — PR 5 already renders real data from regtest.

**Parallelizable:** PR 25 (Storybook) can land any time after PR 2. PR 26 (Sentry) can land any time after PR 21.

---

## Verification strategy

**Per-PR:** inline "Verify" steps. Most require a regtest `litd` on `https://localhost:8443`; PR 10 and PR 23 unit tests don't.

**Regtest bring-up** (locked in PR 24): script under `e2e/setup/regtest.sh` that stands up `bitcoind -regtest`, `lnd` pair, `litd`, `loopd`, `poold`, opens a pre-funded channel between the pair. Invoked locally for manual QA and in CI for Playwright.

**Continuous:** `yarn lint`, `yarn tsc`, `yarn test`, `yarn build` all green on every PR. `yarn e2e` green from PR 24 onward.

**Showcase validation (after PR 31):** external reviewer can clone, run `./e2e/setup/regtest.sh && yarn dev`, log in, see live channel + transaction streams, initiate a swap, abort it, complete another. Architecture diagram + README reads as a teaching artifact in under 5 minutes.

---

## Critical files from `app/` referenced during the rebuild

- `app/scripts/build-protos.js` — proto download + version-resolution logic (reused verbatim for the URL list; the jstype patching step drops away).
- `app/src/store/store.ts:174–191` — stream wiring template for `useStreamingQuery` subscriptions.
- `app/src/store/stores/channelStore.ts` — Band 1 reference for PR 9; `onChannelEvent` is the merge-fn template for PR 11.
- `app/src/store/stores/authStore.ts:41–46` — credential handling; `getErrMsg` is the PR 14 error-translation template.
- `app/src/store/views/buildSwapView.ts` — 570 lines of wizard state; the PR 20–21 complexity target to match pedagogically (not line-for-line).
- `app/src/store/stores/swapStore.ts` — `onSwapUpdate`'s terminal-state ordering rule for PR 19.
- `app/src/store/stores/orderStore.ts` — `submitOrder`'s `invalidOrder` partial-failure handling for PR 16.
- `app/src/store/COMPLEXITY_GUIDE.md` — the band model this roadmap follows.
- `app/src/api/base.ts:14–18` — Basic-auth metadata construction; ported into the Connect-ES interceptor in PR 4.
- `app.go:16` + `terminal.go:1658–1707` — deployment constraint on `app/build/*` (confirms `app-next/` output doesn't need to be embed-compatible).

---

## Cadence

33 PRs (31 plus the 1.5 agent-infra and 3.5 codegen-gitignore interstitials) over ~6–10 weeks of part-time work = ~3–5 PRs/week. Agentic workflow means implementation time drops considerably; the bottleneck shifts to human review bandwidth. Adjust by splitting L-sized PRs (13, 20, 24) if review time gets constrained.
