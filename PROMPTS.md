# Alchemy — Agent prompt stubs

Copy a section into your agent with the diff or target paths attached.

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [docs/REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks & tests)

**Pre-push:** `npm run lint:ci && npm test` · **Full gate:** `npm run check:push` ([CONTRIBUTING.md](./CONTRIBUTING.md))

---

## Code reduction audit

Audit for dead code, duplication, and unnecessary abstraction. Run `npm run deadcode`. See [AGENTS.md — Large / generated / heavy files](./AGENTS.md#large--generated--heavy-files).

**When done:** `npm run lint:ci && npm test`

---

## Type safety audit

Hunt `any`, `@ts-expect-error`, and unsafe casts in changed files. Prefer narrowing and Zod at persistence boundaries. See [AGENTS.md — Key conventions](./AGENTS.md#key-conventions) and [WORKFLOWS — persisted save data](./docs/WORKFLOWS.md#change-persisted-save-data).

**When done:** `npm run lint:ci && npm test`

---

## Import boundary audit

Verify changed files respect [AGENTS.md § Import boundaries](./AGENTS.md#import-boundaries-eslint) and [ARCHITECTURE.md § Import boundaries](./docs/ARCHITECTURE.md#import-boundaries). Run `npm run lint`.

**When done:** `npm run lint:ci`

---

## Battle mechanics audit

Verify changes match [REFERENCE.md § Battle implementation rules](./docs/REFERENCE.md#battle-implementation-rules). Immutable `BattleState`, `state.rng`, `adjustEnemyStatusDelta()` for enemy status, static `enemyAttackEffects`.

**When done:** `npm test -- tests/lib/battle`

---

## New card / effect audit

Follow [WORKFLOWS.md — task index](./docs/WORKFLOWS.md#task-index) and `src/lib/game-data/effects/BATTLE_HANDLERS.md`. One handler per effect kind in `lib/battle/effect-handlers/`.

**When done:** `npm test -- tests/lib/game-data/descriptions-match-effects.test.ts && npm test -- tests/lib/battle`

---

## Run materials audit

Player-earned materials must use `awardMaterialsDuringRun()` — not `useHomesteadStore.addMaterials()` from run-loop code. See [WORKFLOWS § Grant materials](./docs/WORKFLOWS.md#grant-materials-during-a-run).

**When done:** `npm test -- tests/features/run/run-victory-handlers.test.ts`

---

## Save / migration audit

Follow [WORKFLOWS.md — change persisted save data](./docs/WORKFLOWS.md#change-persisted-save-data). Update Zod schemas, `snapshotRun` / `restoreRun`, and storage tests.

**When done:** `npm run check:ship` (redundant with `save-migration-guard` if that passes)

---

## Screen / route audit

New screens: `run-loop/screens/` or `meta/screens/` → `shared/screens/index.ts` → `src/app/screen-routes/`. No `React.lazy` on routes. See [WORKFLOWS.md — adding a new screen](./docs/WORKFLOWS.md#adding-a-new-screen).

**When done:** `npm run lint:ci && npm test`

---

## UI / motion audit

Panel enter: [WORKFLOWS § Staggered screen enter](./docs/WORKFLOWS.md#staggered-screen-enter-motion). Hard rules: [AGENTS.md § UI hard rules](./AGENTS.md#ui-hard-rules). Failure modes: [AGENTS.md § Common mistakes](./AGENTS.md#common-mistakes).

**When done:** `npm run lint:ci`
