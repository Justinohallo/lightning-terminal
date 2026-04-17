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

Tracked as a series of focused PRs. Each PR teaches one idea. See the pinned tracking issue
in this fork.
