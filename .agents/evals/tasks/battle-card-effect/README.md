# Task: Battle — add card effect kind

Setup: Use an isolated eval worktree and pick an unused `BattleCardEffect` kind name.

Goal: Add kind per `docs/WORKFLOWS.md#add-a-new-card-effect-kind` — schema in `src/lib/game-data/effects/`, handler in `src/lib/battle/effect-handlers/`, registry + metadata wiring, card using it (`descriptionLines` matches).

Pass when:

- `npm run typecheck:all` passes
- `npm run lint` + `npm run lint:boundaries` passes
- `effects-registry.test.ts` + `effect-handlers-registry.test.ts` + `unit-battle` green
- No `Math.floor`/`Math.random` lint regressions

Run: `npm run verify:changed -- src/lib/game-data/effects/damage-schemas.ts src/lib/battle/damage-calc.ts` (or `src/lib/game-data/** src/lib/battle/**` — bare `src/lib/battle` does not route)
