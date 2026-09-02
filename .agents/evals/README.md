# Agent Evals — Lightweight Scaffold

Validate skill/instruction changes against representative tasks before promoting to active skill. Keep pragmatic; no autonomous benchmark framework.

## When to use

Proposed skill or persistent-knowledge promotion that would affect routine coding should be checked against 1-2 representative tasks. One-off fixes don't need evals.

## Objective signals

- `npm run typecheck:all` passes (no new errors)
- `npm run lint` + `npm run lint:boundaries` passes
- `npm run verify -- --diff --plan` selection is minimal and correct
- `npm run docs:check` passes (no broken links/anchors)
- Tests selected for the touched paths pass
- No unexpected warnings; diff is as large as needed for the best long-term shape and no larger; no redundant abstractions/files, no workaround hacks left behind
- Task requirements satisfied vs. spec (not just green CI)

## How to add a task

Create a `tasks/<slug>/README.md` with:

```md
# Task: short name

Setup: isolated eval worktree / seed state
Goal: what agent should do
Steps: optional hints (link WORKFLOWS checklist)
Pass when: objective signals above + domain assertion
Run: npm run verify -- <paths>
```

Keep tasks file-backed, not code-generated, and grounded in real repo workflows. Prefer existing `scripts/lib/change-routes.mjs` routes.

## Representative tasks

- [Battle — add a card effect kind](./tasks/battle-card-effect/README.md)
- [Save — add a defaulted field](./tasks/save-additive-field/README.md)
- [Shop — change price refresh](./tasks/shop-price-refresh/README.md)

Do not invent tasks with no meaningful pass/fail. If a task cannot be checked objectively, document it as `uncertain` and skip promotion.
