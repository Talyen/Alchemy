# Agent Evals — Lightweight Scaffold

Validate skill/instruction changes against representative tasks before promoting to active skill. Keep pragmatic; no autonomous benchmark framework.

## When to use

Proposed skill or persistent-knowledge promotion that would affect routine coding should be checked against 1-2 representative tasks. One-off fixes don't need evals.

## Objective signals

- `npm run typecheck:all` passes (no new errors)
- `npm run lint` + `npm run lint:boundaries` passes
- `npm run verify:changed -- --diff --plan` route is minimal and correct
- `npm run docs:check` passes (no broken links/anchors)
- Tests for touched route pass (`verify:changed` selected suite)
- No unexpected warnings; diff is as large as needed for the best long-term shape and no larger; no redundant abstractions/files, no workaround hacks left behind
- Task requirements satisfied vs. spec (not just green CI)

## How to add a task

Create a `tasks/<slug>/README.md` with:

```md
# Task: short name

Setup: branch / seed state
Goal: what agent should do
Steps: optional hints (link WORKFLOWS checklist)
Pass when: objective signals above + domain assertion
Run: npm run verify:changed -- <paths>
```

Keep tasks file-backed, not code-generated, and grounded in real repo workflows. Prefer existing `scripts/lib/change-routes.mjs` routes.

## Representative tasks (stubs)

### 1. Battle — add card effect kind

- **Setup:** Add a new `BattleCardEffect` kind per `docs/WORKFLOWS.md#add-a-new-card-effect-kind`.
- **Goal:** Schema in `effects/`, handler in `battle/effect-handlers/`, registry wiring, metadata.
- **Pass:** `effects-registry.test.ts` + `effect-handlers-registry.test.ts` + `unit-battle` green; no `Math.floor`/`Math.random` lint errors.
- **Run:** `npm run verify:changed -- src/lib/game-data/effects src/lib/battle`

### 2. Save — additive field

- **Setup:** Add optional persisted field with Zod `.default()` (no migration bump) per `MIGRATIONS.md`.
- **Goal:** Schema + defaults + fixtures updated together; old saves load.
- **Pass:** `test:ship:unit` (save-migration-guard) green; `docs:check` green.
- **Run:** `npm run verify:changed -- src/lib/validation/save-schemas src/features/alchemy/shared/storage`

### 3. Shop — price refresh

- **Setup:** Change shop pricing via `shop-transactions.ts` draft recipe.
- **Goal:** Gold guard reads draft; SFX in `afterCommit`; no nested dispatch.
- **Pass:** `unit-shop` green; `lint:boundaries` green; `no-run-earned-add-materials` not regressed.
- **Run:** `npm run verify:changed -- src/features/alchemy/run-loop/shop`

Do not invent tasks with no meaningful pass/fail. If a task cannot be checked objectively, document it as `uncertain` and skip promotion.
