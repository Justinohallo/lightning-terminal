# app-next

Showcase rebuild of the `lightning-terminal` frontend.

> **Not a drop-in replacement.** This directory is an independent, parallel frontend built
> for inspiration and educational review. The production UI continues to ship from `../app/`,
> embedded into the `litd` binary via `//go:embed app/build/*`. `app-next/` builds to its
> own `dist/` and is served for review via `yarn preview` or `npx serve`.

## What this demonstrates

- **Server state vs. client state** as a first-class architectural split: TanStack Query
  owns server data; Zustand owns UI state; `useStreamingQuery` is the seam for gRPC
  server-streams.
- **Cross-feature coordination via cache invalidation**, not imperative cross-store calls.
- **Typed gRPC** via `@bufbuild/protoc-gen-es` + `@connectrpc/protoc-gen-connect-es` — `uint64`
  fields arrive as `bigint`, no hand-written `[jstype=JS_STRING]` patch.
- **Domain models without reactivity libraries** — plain classes, pure functions, tests.

## Non-goals

- Byte-equivalent behavior with `../app/`.
- Production release process — no mainnet QA, no accessibility audit beyond Radix defaults.
- Upstream PRs. All work lands in the fork's long-lived `rebuild` branch; feature PRs target
  that branch as `app-next/NN-description`. See the plan for the git model.

## Running locally

Package manager: **pnpm** (pinned via `packageManager` in `package.json`; enable
with `corepack enable` if you don't have it installed globally).

```bash
cd app-next
pnpm install
pnpm dev        # starts Vite at http://localhost:3000
                # gRPC paths are proxied to https://localhost:8443 (regtest litd)
```

Build:

```bash
pnpm build
pnpm preview
```

Type-check:

```bash
pnpm tsc
```

## Stack

Vite · React 19 · TypeScript strict · (later PRs add) Tailwind + shadcn · TanStack Query +
Router · Connect-ES · Zustand · React Hook Form + Zod · Vitest · Playwright.

## Roadmap

The full PR-sequenced rebuild plan lives in **[`docs/ROADMAP.md`](./docs/ROADMAP.md)** —
phases, keystone PRs, architecture decisions, and the git workflow are all there.

## Built with Claude Code

This rebuild is implemented primarily by [Claude Code](https://claude.com/claude-code),
with a human doing review and pattern enforcement. The agent infrastructure is committed
to the repo for reproducibility:

- **[`CLAUDE.md`](./CLAUDE.md)** — standing rules (architecture invariants, file layout,
  coding conventions, git rules) that Claude reads at the start of every session.
- **[`.claude/settings.json`](./.claude/settings.json)** — scoped permissions so the agent
  can run `pnpm`, common `git` / `gh` read commands freely, but confirms before any
  shared-state action (commit, push, PR). `app/**` is in the deny list so no
  production-code changes can leak in.
- **[`.claude/commands/`](./.claude/commands/)** — slash commands for recurring flows:
  `/pr <NN>`, `/sync-upstream`, `/verify`, `/prep-merge`.
- **[`.claude/agents/`](./.claude/agents/)** — specialized sub-agents: `band-reviewer`
  (catches architecture-invariant violations before review), `test-writer`, `story-writer`.

The session cadence for each PR is documented in `CLAUDE.md` § "PR flow".
