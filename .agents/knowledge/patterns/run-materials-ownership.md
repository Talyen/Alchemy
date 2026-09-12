# Run-Earned Materials Ownership

Status: enforced-rationale
Confidence: high

## Observation

Player loot earned during a run (mystery choices, combat crystals, reward screens) was sometimes granted via profile `addMaterials()` directly, bypassing `activeRun.runMaterialsEarned`. Run-end summary then under-reports, homestead inventory diverges from run ledger.

## Why it matters

An inventory award without its run-ledger entry makes the recap disagree with the player's earnings. `awardMaterialsDuringRun(draft, materials)` keeps both writes in the same command. The [material workflow](../../../docs/WORKFLOWS.md#grant-materials-during-a-run) owns bonus application and recap assembly; [Armory write paths](../../../docs/ARMORY.md#write-paths) distinguish in-run salvage from meta grants.

## Evidence

- `docs/WORKFLOWS.md#grant-materials-during-a-run` — checklist + call sites (`mystery-flow.ts` `gainMysteryMaterial`, `victory-commands.ts` `commitVictoryRewards`, `reward-commands.ts` `claimRunReward`).
- `src/features/alchemy/shared/stores/run-session-write-port.ts` — `awardMaterialsDuringRun`.
- `src/lib/homestead/loot.ts` — `applyMaterialFindBonus()` bonus before award (mystery/combat already apply).
- `eslint/plugin.js` — `alchemy/no-run-earned-add-materials` (error in `src/**`).
- `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts` — material grant coverage.
- `docs/ARMORY.md#write-paths` — salvage material grant uses `awardMaterialsDuringRun` (active run) vs `addMaterials` (meta).

## Resolution

[WORKFLOWS.md](../../../docs/WORKFLOWS.md#grant-materials-during-a-run) owns the
call pattern and explicit exceptions. The repository-wide
`alchemy/no-run-earned-add-materials` rule enforces the recurring mistake.
