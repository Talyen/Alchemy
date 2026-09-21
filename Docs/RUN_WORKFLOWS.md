# Run and save workflows

## Change persisted save data

1. Decide whether the change needs a version bump or a safe additive default using the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#when-to-increment).
2. Follow its [required pattern](../src/features/alchemy/shared/storage/MIGRATIONS.md#required-pattern-automated), updating the schema, domain defaults, codecs, and fixtures together. [Defaults and resume normalization](../src/features/alchemy/shared/storage/MIGRATIONS.md#defaults-and-resume-normalization) names the owners; [deletion](../src/features/alchemy/shared/storage/MIGRATIONS.md#deletion) owns clear-save modes.
3. Verify the [save test expectations](../src/features/alchemy/shared/storage/MIGRATIONS.md#test-expectations) through the [task-scoped gate](../CONTRIBUTING.md#what-to-run-when-you-change), which selects the complete save/persistence suite. Reuse `tests/helpers/save-candidate-fixtures.ts` for candidate scenarios.

---

## Change mid-run resume (`ActiveRunData`)

1. Classify the field as active-run progression or transient resume state. Keep the aggregate shape and the wire shape owned by their existing modules; mid-combat fields still use `PersistedBattleStateSchema`.
2. Update the active-run schema and, for progression fields, the shared `run-progress.ts` schema plus fresh/resume initialization in `run-state-init.ts`. Wire/live progression types and serialization keys derive from that schema. Use defaults and normalization before adding a migration step; the save contract is in [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md).
3. Update `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()` in `run-resume-codec.ts`. This codec is the sole `RunSession` ↔ `ActiveRunData` translation boundary; shops and interrupted flow keep their focused codec helpers.
4. Keep `snapshotRun()` / `restoreRun()` as thin lifecycle wrappers and publish boot/resume through one `dispatchRunSessionCommand()`. Defer navigation, audio, and presentation work until after commit.
5. Run the active-run snapshot/codec tests plus the storage/migration tests named by the save contract. Use the changed-path route for the final selection.

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-write-port.ts`) so homestead inventory and `activeRun.runMaterialsEarned` stay aligned for the run-end summary.

1. Route combat payouts through `computeCombatMaterialReward()` and mystery grants through `computeMysteryMaterialReward()` (both in `@/lib/homestead/material-rewards`); they own herb-find, scavenger/herbalist, and elite/boss ordering per the policy table there. Do not reimplement the sequence at the call site.
2. Call `awardMaterialsDuringRun(draft, materials)` inside the owning command (`run-loop/run/victory-commands.ts`, `run-loop/run/reward-commands.ts`, `run-loop/navigation/mystery-flow.ts`, or Armory salvage in `shared/stores/gear-session-command.ts`). The canonical site list is `AWARD_MATERIALS_CALL_SITES` in `run-loop/run/run-materials.ts`, enforced by `tests/architecture/run-materials-award-guard.test.ts`; new grant paths must extend it there.
3. Reuse the run-end display: `awardRunEndMaterials` in `run-loop/run/run-materials.ts`, used by both defeat and victory flows, merges `runMaterialsEarned` and `applyEndOfRunHomesteadBonuses` into `session.runEndMaterials`.
4. Check `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts` and the affected mystery/reward-flow tests when adding a new source.

**Do not** call `addMaterialsToStockpile()` on the run profile store directly from run-loop or mystery code for player loot.

Permanent Gear and Armory Trinkets use `recordRunObtainedItem()` at each grant site (reward Gear/Trinket picks, equipment shop, trinket shop, mystery generated Gear). `finalizeRunEndSession` copies `activeRun.runObtainedItems` into `session.runEndItems` for the run-end recap. Do not record Boons or cards.

---

## Add or change post-victory routing (`REWARD_ROUTES`)

The Alchemist encounter bonus grants one Potion after the final reward choice or skip, including encounters with a follow-up bonus card choice.

Follow-up choices include Companion cards, Archery cards from Fletched, Wish cards from Wishkeeper, and Nature cards from Kindred Spoils. The saved `companionChoiceIds` field carries all of these bonus choices. Primary and bonus choices restore against the full card catalog in their saved order, dropping only missing IDs; loading never rerolls choices or reapplies offer-pool or theme eligibility.

An interrupted bonus handoff resumes only the bonus choices: the primary reward and its materials have already committed. Unclaimed rewards whose choices no longer resolve stay on Rewards with Skip available, retaining materials and routing metadata across repeated saves until finalized. Loading never awards materials.

Destination eligibility uses health and maximum health after victory bonuses and the upcoming location’s loot depth. Combat and Wildwood exclude exhausted Boon and permanent-Trinket pools before sampling through the [shared loot policy](./ARMORY.md#loot-tuning). Pass progression from `resolveDraftLootProgress()` when generating new loot; loading pending rewards or shop offers must not reapply progression eligibility.

- **1. Add route constant** — `src/lib/routing/reward-routes.ts` → `REWARD_ROUTES`, re-exported from `@/lib/routing`
- **2. Compute route after rewards** — `src/features/alchemy/run-loop/navigation/reward-flow.ts` (`finalizeRewardState` / related; import `@/features/alchemy/run-loop/navigation/reward-flow`)
- **3. Handle transition** — `run-loop/run/run-flow-rewards.ts` (`executeRewardRouteTransition`) for reward routing; `shell/run-flow-engine.ts` (`createRunFlowEngine`) for shell wiring of all flow factories
- **4. Tests** — `tests/features/alchemy/run-loop/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run

---

## Run teardown

Feature code uses [`run-lifecycle.ts`](../src/features/alchemy/shared/stores/run-lifecycle.ts):

- `teardownRun()` — clear the active run session after victory, defeat, or abandon.
- `finalizeRunEndSession()` — run-end bookkeeping plus persist (navigation calls this on run end).
- `flushSaveAfterGearMutation()` — immediate persist after Armory gear mutations (fast path alongside the autosave debounce; both share the save queue).

[`reset.ts`](../src/features/alchemy/shared/stores/reset.ts) owns test/teardown and Options wipe:

- `resetTransientRunUi()` — UI hover/shimmer plus transient session fields.
- `clearAllPersistentGameData()` — clears app options, permanent run/talent data, and homestead (Options “clear save”).

## Gameplay command boundary

Ownership and anti-patterns: [ARCHITECTURE.md § Run state](./RUN_STATE.md#run-state). Keep the command synchronous; put audio, navigation, timers, and presentation cleanup in `afterCommit`. Pass the draft to every gameplay mutator. This outer-boundary example awards an already bonus-adjusted material amount and passes it to presentation feedback after commit:

```ts
import type { MaterialInventory } from "@/lib/homestead/types";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";

export function awardMaterialReward(
  materials: MaterialInventory,
  onAwarded: (awarded: MaterialInventory) => void,
): void {
  dispatchRunSessionCommand(
    (draft) => {
      awardMaterialsDuringRun(draft, materials);
      return materials;
    },
    { afterCommit: onAwarded },
  );
}
```

Inside an existing reward, shop, or mystery command, call the mutator with that command's draft instead of dispatching another command. Keep the existing claim guard and reward finalization in the owning flow.

Resolve battle gameplay and commit its RNG/XP before starting presentation. Return detached frames for playback; never commit gameplay from a draw or animation callback. `activeCombat.pendingBattleTransition` is retained only for consuming older saves, not for authoring new animation flows.

---
