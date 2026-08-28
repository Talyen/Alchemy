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

## Preferred pattern

- In-run loot: `awardMaterialsDuringRun(materials)` inside `dispatchRunSessionCommand`.
- Apply `applyMaterialFindBonus()` before award where caller hasn't already (mystery/combat do).
- Permanent Gear discovery: `recordRunObtainedItem()` per grant; `finalizeRunEndSession` copies `activeRun.runObtainedItems → session.runEndItems`.
- Do not record Boons/cards via `recordRunObtainedItem`.

## Exceptions

- Meta grants outside a run (shop-salvage in meta context, dev tools) correctly use `addMaterials`.
- `clearAllPersistentGameData()` wipe path.

## Enforcement opportunity

Strongest: custom ESLint rule `no-run-earned-add-materials` already errors. Could narrow further to forbid `addMaterials` import in `src/features/alchemy/run-loop/**` except salvage wrapper; currently rule is repo-wide warning via targeted glob — sufficient.
