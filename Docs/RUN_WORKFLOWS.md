# Run and save workflows

## Change persisted save data

1. Decide whether the change needs a version bump or a safe additive default using the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#when-to-increment).
2. Follow its [required pattern](../src/features/alchemy/shared/storage/MIGRATIONS.md#required-pattern-automated), updating the schema, domain defaults, codecs, and fixtures together. [Defaults and resume normalization](../src/features/alchemy/shared/storage/MIGRATIONS.md#defaults-and-resume-normalization) names the owners; [deletion](../src/features/alchemy/shared/storage/MIGRATIONS.md#deletion) owns clear-save modes.
3. Verify the [save test expectations](../src/features/alchemy/shared/storage/MIGRATIONS.md#test-expectations) with the relevant save/persistence unit suites (`npm run test:full -- <test-paths>`), then run the [task-scoped gate](../CONTRIBUTING.md#what-to-run-when-you-change). The default local gate does not select the complete save suite; the opt-in full verifier does. Reuse `tests/helpers/save-candidate-fixtures.ts` for candidate scenarios.

---

## Change mid-run resume (`ActiveRunData`)

1. Classify the field as active-run progression or transient resume state. Keep the aggregate shape and the wire shape owned by their existing modules; mid-combat fields still use `PersistedBattleStateSchema`.
2. Update the active-run schema and, for progression fields, the shared `run-progress.ts` schema plus fresh/resume initialization in `run-state-init.ts`. Wire/live progression types and serialization keys derive from that schema. Use defaults and normalization before adding a migration step; the save contract is in [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md).
3. Update `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()` in `run-resume-codec.ts`. This codec is the sole `RunSession` ↔ `ActiveRunData` translation boundary; shops and interrupted flow keep their focused codec helpers.
4. Keep `snapshotRun()` / `restoreRun()` as thin lifecycle wrappers and publish boot/resume through one `dispatchRunSessionCommand()`. Defer navigation, audio, and presentation work until after commit.
5. Run the active-run snapshot/codec tests plus the storage/migration tests named by the save contract using `npm run test:full -- <test-paths>`. Follow the [verification policy](../CONTRIBUTING.md#what-to-run-when-you-change) for the final gate; the default local gate does not perform dependency-related selection.

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-write-port.ts`) so homestead inventory and `activeRun.runMaterialsEarned` stay aligned for the run-end summary.

Campaign, Labyrinth, and Wildwood victories grant enemy-based Materials through the same reward flow; Wildwood shows them beside Gold on its existing Victory screen and includes them in the run-end summary.

1. Route combat payouts through `computeCombatMaterialReward()` and mystery grants through `computeMysteryMaterialReward()` (both in `@/lib/homestead/material-rewards`); they own herb-find, scavenger/herbalist, and elite/boss ordering per the policy table there. Do not reimplement the sequence at the call site.
2. Call `awardMaterialsDuringRun(draft, materials)` inside the owning command (`run-loop/run/reward-commands.ts`, `run-loop/navigation/mystery-flow.ts`, or Armory salvage in `shared/stores/gear-session-command.ts`). The canonical site list is `AWARD_MATERIALS_CALL_SITES` in `shared/stores/run-materials.ts`, enforced by `tests/architecture/run-materials-award-guard.test.ts`; new grant paths must extend it there.
3. Reuse the run-end display: `awardRunEndMaterials` in the write port (implementation in `shared/stores/write/run-end.ts`), used by both defeat and victory flows, merges `runMaterialsEarned` and `applyEndOfRunHomesteadBonuses` into `session.runEndMaterials`.
4. Check `tests/features/alchemy/run-loop/run/run-victory-handlers.dom.test.ts` and the affected mystery/reward-flow tests when adding a new source.

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
- **3. Handle transition** — `run-loop/run/run-flow.ts` (presentation of committed reward transitions) for reward routing; `shell/run-flow-engine.ts` (`createRunFlowEngine`) for shell wiring of all flow factories
- **4. Tests** — `tests/features/alchemy/run-loop/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run

---

## Run teardown

Run outcome flows use [`run-end-commands.ts`](../src/features/alchemy/run-loop/run/run-end-commands.ts), which supplies the settlement callbacks to [`run-lifecycle.ts`](../src/features/alchemy/shared/stores/run-lifecycle.ts):

- Victory: `completeRunVictory()` calls `finalizeRunEndSession()` to award earned progression, capture the victory recap, end resumable activity, and flush the save.
- Defeat: `completeRunDefeat()` calls `applyRunDefeatTeardown()` to settle progression with a death recap, clear combat state, and perform defeat feedback and saving after commit.
- Voluntary End Run: `abandonCurrentRun()` calls `abandonRun()` to settle progression with an abandoned recap and clear resumable activity immediately. The battle route retains its outgoing display for the screen fade; the flow navigates to the End Run screen.

`teardownRun()` is a raw session reset with presentation cleanup. It does not award progression, capture a recap, or explicitly flush the save; do not substitute it for an outcome command.

`flushSaveAfterGearMutation()` provides immediate persistence after Armory mutations (the fast path and autosave debounce share the save queue).

[`reset.ts`](../src/features/alchemy/shared/stores/reset.ts) owns test/teardown and Options wipe:

- `resetTransientRunUi()` — test/boot helper that resets the UI store and transient session fields. Clearing the session removes active combat along with its activity, without settling progression or cleaning up battle playback; use the outcome/lifecycle commands above for a live run.
- `clearAllPersistentGameData()` — Options' Clear Save Data action. It first deletes save slots through `localWipe`; only acknowledged deletion resets settings, profile discoveries/unlocks, Talents, Homestead, Gear, and active-run state. Failure leaves memory unchanged. Device-local display sizes and demo-import initialization receipts survive under the [deletion contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#deletion).

## Gameplay command boundary

Ownership and anti-patterns: [RUN_STATE.md § Run state](./RUN_STATE.md#run-state). Keep the command synchronous; put audio, navigation, timers, and presentation cleanup in `afterCommit`. Pass the draft to every gameplay mutator and return an explicit `acceptCommand(value)` or `rejectCommand(reason, fallback)`. Rejection discards all writes and RNG draws and skips `afterCommit`; the dispatcher returns the supplied value or fallback. This outer-boundary example awards an already bonus-adjusted material amount and passes it to presentation feedback after commit:

```ts
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";

export function awardMaterialReward(
  materials: MaterialInventory,
  onAwarded: (awarded: MaterialInventory) => void,
  session: GameSession,
): void {
  dispatchRunSessionCommand(
    (transaction) => {
      awardMaterialsDuringRun(transaction, materials);
      return acceptCommand(materials);
    },
    { afterCommit: onAwarded },
    session,
  );
}
```

Inside an existing reward, shop, or mystery command, call the mutator with that command's draft instead of dispatching another command. Keep the existing claim guard and reward finalization in the owning flow.

Resolve battle gameplay and commit its RNG/XP before starting presentation. Return detached frames for playback; never commit gameplay from a draw or animation callback. Older activity fields are read only by migration; unfinished legacy combat is abandoned after winner selection, without executing obsolete rules.

---

## Campfire brewing and Transmutation visits

`navigation/alchemy-commands.ts` initializes fixed visit offers using the saved events RNG stream. Campfire and Transmutation activities own offers, completion, and result cards; the resume codec persists them independently of the visible menu. Returning or reloading must not regenerate an initialized visit.

Brew and exchange commands validate the current activity, completion, source eligibility, and selected offers before writing. Payment, deck replacement, discovery, and visit use commit synchronously through the run-session write port. Campfire Rest and Brew are mutually exclusive. Campfire brewing automatically mixes two eligible, unbrewed standard Potion instances when available; otherwise, choosing one of the three saved offers immediately grants it. Both the screen and command enforce this choice. The Campfire route passes active room modifiers to the screen so Hidden Purse and Herbal Hearth rewards are acknowledged after Rest, including resume; brewing does not claim those Rest rewards. The Alchemist exposes Mix Potion and Strengthen Potion as separate services sharing the existing price and once-per-visit brewing allowance. Transmutation immediately locks in the selected source card, then selecting a replacement commits the exchange and advances without confirmation or a result summary. Mixed and strengthened Potions remain ineligible. Completed visits and visits with no valid exchange advance automatically after offer initialization. A completed Labyrinth support visit clears its pending node through the existing progression flow.
