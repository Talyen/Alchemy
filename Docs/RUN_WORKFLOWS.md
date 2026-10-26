# Run and save workflows

These are editing sequences; [run state](./RUN_STATE.md) and
[save compatibility](../src/features/alchemy/shared/storage/MIGRATIONS.md) own the
contracts. Before handoff, check the affected acceptance/rejection and resume
behavior, then run [the task gate](../CONTRIBUTING.md#what-to-run-when-you-change).

## Change persisted save data

1. Decide whether the change needs a version bump or a safe additive default using the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#when-to-increment).
2. Update the schema, domain defaults, owning codec and fixtures together under
   the [schema change contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#schema-change-contract).
   Preserve exhaustive field selections and introduce ordered transformations only
   when supported formats require them. [Default owners](../src/features/alchemy/shared/storage/MIGRATIONS.md#defaults-and-resume-normalization)
   locate initialization and recovery; clear-save changes follow [deletion](../src/features/alchemy/shared/storage/MIGRATIONS.md#deletion).
3. Check [save expectations](../src/features/alchemy/shared/storage/MIGRATIONS.md#test-expectations),
   reusing `tests/helpers/save-candidate-fixtures.ts` for candidate scenarios.

---

## Change mid-run resume (`ActiveRunData`)

1. Classify the field as active-run progression or transient resume state. Keep the aggregate shape and the wire shape owned by their existing modules; mid-combat fields still use `PersistedBattleStateSchema`.
2. Update the active-run schema and, for progression fields, `PersistedRunProgress` and `ACTIVE_RUN_PROGRESS_KEYS` in `src/lib/active-run-session/run-progress.ts`, the matching validation schema in `src/lib/validation/save-schemas/run-progress.ts`, and fresh/resume initialization in `run-state-init.ts`. The domain contract owns shared wire/live fields and serialization keys; validation owns recovery defaults. Follow the [shared run-progress contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#shared-run-progress-shape), preserving the distinction between fresh-run defaults and missing-field recovery.
3. Update `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()` in `run-resume-codec.ts`. This codec is the sole active-run progress/session ↔ `ActiveRunData` translation boundary; shops and interrupted flow keep their focused codec helpers.
4. Keep `snapshotRun()` / `restoreRun()` as thin lifecycle wrappers and publish boot/resume through one `dispatchRunSessionCommand()`. Defer navigation, audio, and presentation work until after commit.
5. Check active-run round trips and affected storage recovery with the
   [save expectations](../src/features/alchemy/shared/storage/MIGRATIONS.md#test-expectations).

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-write-port.ts`) so homestead inventory and `activeRun.runMaterialsEarned` stay aligned for the run-end summary.

Campaign, Labyrinth, and Wildwood victories grant shared combat Materials through the same reward flow; Wildwood shows them beside Gold on its existing Victory screen and includes them in the run-end summary.

1. Route combat payouts through `computeCombatMaterialReward()` and mystery grants through `computeMysteryMaterialReward()` (both in `@/lib/homestead/material-rewards`); they own shared encounter-type/band bundles, location modifiers, and final Homestead find bonuses. Direct Wish payouts use the same quantity helper before emitting feedback and pending rewards. Do not reimplement or repeat the sequence at the call site.
2. Call `awardMaterialsDuringRun(transaction, materials)` inside the owning command (`run-loop/run/reward-commands.ts`, `run-loop/navigation/mystery-flow.ts`, or Armory salvage in `shared/stores/commands/gear-session-command.ts`). The `alchemy/no-run-earned-add-materials` lint rule prevents raw stockpile grants from consumers and tally mutations outside the write port.
3. Reuse the run-end display: `settleRunEnd` in `shared/stores/commands/write/run-end.ts`, used by all endings, copies `runMaterialsEarned` into `session.runEndMaterials` and clears the tally. Resource summaries and talent XP finalization are private settlement steps; feature commands cannot invoke them independently. Materials have already reached the stockpile at their grant site.
4. Check `tests/features/alchemy/run-loop/run/run-victory-handlers.dom.test.ts` and the affected mystery/reward-flow tests when adding a new source.

**Do not** call `addMaterialsToStockpile()` on the run profile store directly from run-loop or mystery code for player loot.

Permanent Gear and Armory Trinkets use `recordRunObtainedItem()` at each grant site (reward Gear/Trinket picks, equipment shop, trinket shop, mystery generated Gear). `finalizeRunEndSession` copies `activeRun.runObtainedItems` into `session.runEndItems` for the run-end recap. Do not record Boons or cards.

---

## Add or change post-victory routing (`REWARD_ROUTES`)

Follow [reward handoff rules](./RUN_STATE.md#reward-handoffs) for bonus choices,
interruption and saved routing; the steps below change the route itself.

- **1. Add route constant** — `src/lib/routing/reward-routes.ts` → `REWARD_ROUTES`, re-exported from `@/lib/routing`
- **2. Compute route after rewards** — `src/features/alchemy/run-loop/navigation/reward-flow.ts` (`finalizeRewardState` / related; import `@/features/alchemy/run-loop/navigation/reward-flow`)
- **3. Handle transition** — `run-loop/run/run-flow.ts` (presentation of committed reward transitions) for reward routing; `shell/run-flow-engine.ts` (`createRunFlowEngine`) for shell wiring of all flow factories
- **4. Tests** — `tests/features/alchemy/run-loop/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run

---

## Run teardown

Run outcome flows use [`run-end-commands.ts`](../src/features/alchemy/run-loop/run/run-end-commands.ts), which passes the session to intent-level commands in [`run-lifecycle.ts`](../src/features/alchemy/shared/stores/commands/run-lifecycle.ts):

- Victory: `completeRunVictory()` calls `finalizeRunEndSession()` to award earned progression, capture the victory recap, end resumable activity, and flush the save.
- Defeat: `completeRunDefeat()` calls `applyRunDefeatTeardown()` to settle progression with a death recap, clear combat state, and perform defeat feedback and saving after commit.
- Voluntary End Run: `abandonCurrentRun()` calls `abandonRun()` to settle progression with an abandoned recap and clear resumable activity immediately. The battle route retains its outgoing display for the screen fade; the flow navigates to the End Run screen.

All endings use the store-owned `settleRunEnd` operation, including victory inside a reward claim and abandonment during restore. It owns earned-resource summaries, permanent XP, hero unlocks, recap snapshots, and activity teardown in one transaction. Callers cannot substitute progression callbacks. Repeated lifecycle completion rejects without another save, defeat sound, or presentation cleanup. `settleRunVictory(transaction)` composes this complete operation inside reward claims; the claim owner flushes its accepted terminal save after commit.

`teardownRun()` is a raw session reset with presentation cleanup. It does not award progression, capture a recap, or explicitly flush the save; do not substitute it for an outcome command.

`flushSaveAfterGearMutation()` provides immediate persistence after Armory mutations (the fast path and autosave debounce share the save queue).

[`reset.ts`](../src/features/alchemy/shared/stores/commands/reset.ts) owns test/teardown and Options wipe:

- `resetTransientRunUi()` — test/boot helper that resets the UI store and transient session fields. Clearing the session removes active combat along with its activity, without settling progression or cleaning up battle playback; use the outcome/lifecycle commands above for a live run.
- `clearAllPersistentGameData()` — Options' Clear Save Data action. It first deletes save slots through `localWipe`; only acknowledged deletion resets settings, profile discoveries/unlocks, Talents, Homestead, Gear, and active-run state. Those changes use one restore publication: outgoing navigation and battle playback are cancelled, snapshots captured during deletion are invalidated, and observers see the complete new career before the confirmation closes. Failure leaves memory and pending presentation unchanged. If the session closes during deletion, the disk operation finishes without publishing into the disposed session. Device-local display sizes and demo-import initialization receipts survive under the [deletion contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#deletion).

## Gameplay command boundary

Start with [command atomicity](./RUN_STATE.md#command-atomicity) and an existing
[production example](./RUN_STATE.md#common-implementation-paths).

1. Extend the owning intent command. Compose write-port operations using its
   readonly transaction; never dispatch a nested command.
2. Return `acceptCommand(value)` or `rejectCommand(reason, fallback)`. Keep
   execution synchronous and non-rollbackable effects after commit.
3. For completed-result feedback, use the session-bound
   `SessionPersistence.afterProgressSaved` (`routeCommands.progress.afterSaved`
   for screens). Input acknowledgment and Saving… remain immediate.
4. Verify the affected acceptance, rejection and persistence behavior, then run
   the [task gate](../CONTRIBUTING.md#what-to-run-when-you-change).

For a new command owner, this example awards an already bonus-adjusted amount
and returns detached data:

```ts
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/commands/run-session-write-port";

export function awardMaterialReward(materials: MaterialInventory, session: GameSession): MaterialInventory {
  return dispatchRunSessionCommand(
    (transaction) => {
      awardMaterialsDuringRun(transaction, materials);
      return acceptCommand(materials);
    },
    undefined,
    session,
  );
}
```

When extending an existing reward, shop or Mystery command, retain its claim
guard and finalization. Battle commands return detached playback frames;
[presentation](./RUN_STATE.md#committed-battle-playback) never commits gameplay.

Fixtures entering the gameplay aggregate follow the same snapshot boundary as
production. Convert an engine fixture with `battleSnapshot(createBattleState(...))`
before assigning it to a battle activity. Keep its RNG and callbacks in the
resolution context; do not cast executable `BattleState` into `BattleSnapshot`.
Pure engine tests can continue to use the execution shape directly.

---

## Campfire brewing and Transmutation visits

Start with [brewing and Transmutation rules](./GAME_RULES.md#brewing-and-transmutation)
and [visit interaction](./UI_BROWSING.md#campfire-and-transmutation).

1. Initialize offers in `run/room-visit-initialization.ts` inside room entry using
   the saved events stream. Rendering, Back and resume never regenerate a visit.
2. Change actions in `navigation/alchemy-commands.ts`. Validate activity,
   completion, eligibility and selected source/offer snapshots before writing;
   payment, deck replacement, discovery and visit use share one synchronous command.
3. Update the [visit codec](../src/features/alchemy/shared/storage/MIGRATIONS.md#alchemy-visits-and-modified-cards)
   when offers, selections, previews or results change. Retain current-format resume.
4. Pass active Campfire room modifiers to the screen, including on resume, so
   Hidden Purse and Herbal Hearth acknowledge only Rest rewards. Completed
   Labyrinth support visits clear their pending node through normal progression.
5. Check fixed offers, repeated/rejected actions, saved result/departure and missing
   result recovery, then run the [task gate](../CONTRIBUTING.md#what-to-run-when-you-change).
   Visible changes also require [visual review](./UI_VISUAL_REVIEW.md).
