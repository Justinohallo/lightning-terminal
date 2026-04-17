---
description: Draft a squash-commit message for the current feature branch
---

Draft the squash message for the current feature branch merging into `rebuild`.

## Gather

```bash
git log rebuild..HEAD --oneline
git diff rebuild...HEAD --stat
```

Note: if stacked on another unmerged feature branch, the base is that branch, not `rebuild`. Check `git merge-base HEAD rebuild` and `git merge-base HEAD <parent-branch>` and use whichever is closer.

## Identify the PR number + title

Read the feature branch name. `app-next/NN-description` → PR NN.

Cross-reference with `@app-next/docs/ROADMAP.md` to get the canonical PR title.

## Draft

Produce a squash message in Conventional Commits format:

```
<type>(app-next): <title in lowercase>

<one-paragraph summary of what this PR does and why — teach the lesson
in plain English. Don't just enumerate the file changes.>

<key technical decisions as bullets — 3 to 6 items>
- ...
- ...

<reference to the ROADMAP entry and any dependent PRs>
See app-next/docs/ROADMAP.md PR <NN>. Stacked on PR <M> (not yet merged).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

`<type>` is one of: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`, `build`, `ci`.

## Output

Print the message for the user to approve or edit. Do not commit anything — the user runs `git merge --squash` (or the GitHub UI's squash-merge button) themselves.
