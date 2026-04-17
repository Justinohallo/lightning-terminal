---
description: Start a new PR from the ROADMAP (scaffolds branch + implementation plan)
argument-hint: <PR number, e.g. 3 or 1.5>
---

You are starting work on PR **$1** from the rebuild roadmap.

## Step 1 — Ground yourself

Read these in order:

1. `@app-next/CLAUDE.md` — the standing rules.
2. `@app-next/docs/ROADMAP.md` — find PR $1's entry. Summarize its scope in one paragraph to the user before touching any files.
3. If the PR has dependencies, confirm they are merged or stacked: run `gh pr list --repo Justinohallo/lightning-terminal --state merged --base rebuild --limit 20` and check that earlier PRs referenced as deps are closed.

## Step 2 — Branch

```bash
git checkout rebuild && git pull origin rebuild
git checkout -b app-next/$1-<short-kebab-description>
```

Derive the short description from the PR's title — max 4 words, kebab-case. Example: PR 3 → `app-next/3-codegen-connect-es`.

If stacking on top of an unmerged predecessor, branch from that predecessor instead of `rebuild` and note the dependency in the PR body.

## Step 3 — Implement

Follow the ROADMAP's scope for PR $1 exactly. Don't expand scope. If you discover that a piece of work logically belongs in a later PR, note it for that PR and stop — don't sneak it in.

Apply every invariant from CLAUDE.md. Write tests where the ROADMAP calls for them.

## Step 4 — Verify locally

```bash
cd app-next
pnpm tsc
pnpm lint
pnpm build
pnpm test          # only if tests exist in this PR scope
```

Fix anything that fails. Don't proceed until all green.

## Step 5 — Self-review with the band-reviewer agent

Invoke the `band-reviewer` sub-agent on the diff. Fix anything it flags. Report its findings to the user along with your fixes.

## Step 6 — Hand off

Tell the user:
- What was implemented.
- What the diff looks like (`git diff rebuild...HEAD --stat`).
- That you're ready to commit and open the PR on their approval.

**Do not commit or push without explicit user approval** — permissions enforce this, but behave as though they didn't.
