# Run-Earned Materials Ownership

Status: active
Confidence: high

## Observation

Player loot earned during a run (mystery choices, combat crystals, reward screens) was sometimes granted via profile `addMaterials()` directly, bypassing `activeRun.runMaterialsEarned`. Run-end summary then under-reports, homestead inventory diverges from run ledger.

## Why it matters

`awardMaterialsDuringRun(materials)` in `run-session-write-port.ts` keeps homestead inventory and `activeRun.runMaterialsEarned` aligned. `awardRunEndMaterials` merges `runMaterialsEarned` + `applyEndOfRunHomesteadBonuses` into `session.runEndMaterials` for recap. Direct `addMaterials` is for meta/Options clear only.

## Evidence

- `docs/WORKFLOWS.md#grant-materials-during-a-run` — checklist + call sites (`mystery-flow.ts` `gainMysteryMaterial`, `run-flow-victory.ts` `commitVictoryRewards`, `run-flow-rewards.ts` `finishRewards`).
- `src/features/alchemy/shared/stores/run-session-write-port.ts` — `awardMaterialsDuringRun`.
- `src/lib/homestead/loot.ts` — `applyMaterialFindBonus()` bonus before award (mystery/combat already apply).
- `eslint/plugin.js` — `alchemy/no-run-earned-add-materials` (error in `src/**`).
- `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts` — material grant coverage.
- `docs/ARMORY.md#write-paths` — salvage material grant uses `awardMaterialsDuringRun` (active run) vs `addMaterials` (meta).

## Resolution

[WORKFLOWS.md](../../../docs/WORKFLOWS.md#grant-materials-during-a-run) owns the
call pattern and explicit exceptions. The repository-wide
`alchemy/no-run-earned-add-materials` rule enforces the recurring mistake.
