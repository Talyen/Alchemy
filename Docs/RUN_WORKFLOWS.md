# Run and save workflows

## Change persisted save data

1. Decide whether the change needs a version bump or a safe additive default using the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#when-to-increment).
2. Follow its [required pattern](../src/features/alchemy/shared/storage/MIGRATIONS.md#required-pattern-automated), updating the schema, domain defaults, codecs, and fixtures together. [Defaults and resume normalization](../src/features/alchemy/shared/storage/MIGRATIONS.md#defaults-and-resume-normalization) names the owners; [deletion](../src/features/alchemy/shared/storage/MIGRATIONS.md#deletion) owns clear-save modes.
3. Verify the [save test expectations](../src/features/alchemy/shared/storage/MIGRATIONS.md#test-expectations) with the relevant save/persistence unit suites (`npm run test:full -- <test-paths>`), then run the [task-scoped gate](../CONTRIBUTING.md#what-to-run-when-you-change). The default local gate does not select the complete save suite; the opt-in full verifier does. Reuse `tests/helpers/save-candidate-fixtures.ts` for candidate scenarios.

---

## Change mid-run resume (`ActiveRunData`)

1. Classify the field as active-run progression or transient resume state. Keep the aggregate shape and the wire shape owned by their existing modules; mid-combat fields still use `PersistedBattleStateSchema`.
2. Update the active-run schema and, for progression fields, `PersistedRunProgress` and `ACTIVE_RUN_PROGRESS_KEYS` in `src/lib/active-run-session/run-progress.ts`, the matching validation schema in `src/lib/validation/save-schemas/run-progress.ts`, and fresh/resume initialization in `run-state-init.ts`. The domain contract owns shared wire/live fields and serialization keys; validation owns recovery defaults. Follow the [shared run-progress contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#shared-run-progress-shape), preserving the distinction between fresh-run defaults and missing-field recovery.
3. Update `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()` in `run-resume-codec.ts`. This codec is the sole active-run progress/session ↔ `ActiveRunData` translation boundary; shops and interrupted flow keep their focused codec helpers.
4. Keep `snapshotRun()` / `restoreRun()` as thin lifecycle wrappers and publish boot/resume through one `dispatchRunSessionCommand()`. Defer navigation, audio, and presentation work until after commit.
5. Run the active-run snapshot/codec tests plus the storage/migration tests named by the save contract using `npm run test:full -- <test-paths>`. Follow the [verification policy](../CONTRIBUTING.md#what-to-run-when-you-change) for the final gate; the default local gate does not perform dependency-related selection.

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-write-port.ts`) so homestead inventory and `activeRun.runMaterialsEarned` stay aligned for the run-end summary.

Campaign, Labyrinth, and Wildwood victories grant shared combat Materials through the same reward flow; Wildwood shows them beside Gold on its existing Victory screen and includes them in the run-end summary.

1. Route combat payouts through `computeCombatMaterialReward()` and mystery grants through `computeMysteryMaterialReward()` (both in `@/lib/homestead/material-rewards`); they own shared encounter-type/band bundles, location modifiers, and final Homestead find bonuses. Direct Wish payouts use the same quantity helper before emitting feedback and pending rewards. Do not reimplement or repeat the sequence at the call site.
2. Call `awardMaterialsDuringRun(transaction, materials)` inside the owning command (`run-loop/run/reward-commands.ts`, `run-loop/navigation/mystery-flow.ts`, or Armory salvage in `shared/stores/gear-session-command.ts`). The `alchemy/no-run-earned-add-materials` lint rule prevents raw stockpile grants from consumers and tally mutations outside the write port.
3. Reuse the run-end display: `settleRunEnd` in `shared/stores/write/run-end.ts`, used by all endings, copies `runMaterialsEarned` into `session.runEndMaterials` and clears the tally. Resource summaries and talent XP finalization are private settlement steps; feature commands cannot invoke them independently. Materials have already reached the stockpile at their grant site.
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

Run outcome flows use [`run-end-commands.ts`](../src/features/alchemy/run-loop/run/run-end-commands.ts), which passes the session to intent-level commands in [`run-lifecycle.ts`](../src/features/alchemy/shared/stores/run-lifecycle.ts):

- Victory: `completeRunVictory()` calls `finalizeRunEndSession()` to award earned progression, capture the victory recap, end resumable activity, and flush the save.
- Defeat: `completeRunDefeat()` calls `applyRunDefeatTeardown()` to settle progression with a death recap, clear combat state, and perform defeat feedback and saving after commit.
- Voluntary End Run: `abandonCurrentRun()` calls `abandonRun()` to settle progression with an abandoned recap and clear resumable activity immediately. The battle route retains its outgoing display for the screen fade; the flow navigates to the End Run screen.

All endings use the store-owned `settleRunEnd` operation, including victory inside a reward claim and abandonment during restore. It owns earned-resource summaries, permanent XP, hero unlocks, recap snapshots, and activity teardown in one transaction. Callers cannot substitute progression callbacks. Repeated lifecycle completion rejects without another save, defeat sound, or presentation cleanup. `settleRunVictory(transaction)` composes this complete operation inside reward claims; the claim owner flushes its accepted terminal save after commit.

`teardownRun()` is a raw session reset with presentation cleanup. It does not award progression, capture a recap, or explicitly flush the save; do not substitute it for an outcome command.

`flushSaveAfterGearMutation()` provides immediate persistence after Armory mutations (the fast path and autosave debounce share the save queue).

[`reset.ts`](../src/features/alchemy/shared/stores/reset.ts) owns test/teardown and Options wipe:

- `resetTransientRunUi()` — test/boot helper that resets the UI store and transient session fields. Clearing the session removes active combat along with its activity, without settling progression or cleaning up battle playback; use the outcome/lifecycle commands above for a live run.
- `clearAllPersistentGameData()` — Options' Clear Save Data action. It first deletes save slots through `localWipe`; only acknowledged deletion resets settings, profile discoveries/unlocks, Talents, Homestead, Gear, and active-run state. Those changes use one restore publication: outgoing navigation and battle playback are cancelled, snapshots captured during deletion are invalidated, and observers see the complete new career before the confirmation closes. Failure leaves memory and pending presentation unchanged. If the session closes during deletion, the disk operation finishes without publishing into the disposed session. Device-local display sizes and demo-import initialization receipts survive under the [deletion contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#deletion).

## Gameplay command boundary

Ownership and anti-patterns: [RUN_STATE.md § Run state](./RUN_STATE.md#run-state). Keep the command synchronous; put non-rollbackable effects in `afterCommit` or after the command returns. Feature commands receive a readonly `RunTransaction`; pass it to every write-port operation and return an explicit `acceptCommand(value)` or `rejectCommand(reason, fallback)`. Rejection discards all writes and RNG draws and skips `afterCommit`; the dispatcher returns the supplied value or fallback. This command-owner example awards an already bonus-adjusted material amount and returns detached result data:

```ts
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";

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

An accepted command has committed in memory; `afterCommit` does not acknowledge a
save. The controller uses its session-bound `SessionPersistence.afterProgressSaved`
(exposed to screens as `routeCommands.progress.afterSaved`) for completed-result
feedback. Keep input acknowledgment and Saving… immediate, following
[completed actions and local saving](./RUN_STATE.md#completed-actions-and-local-saving).

Inside an existing reward, shop, or mystery command, call the mutator with that command's transaction instead of dispatching another command. Keep the existing claim guard and reward finalization in the owning flow.

Resolve battle gameplay and commit its RNG/XP before starting presentation. Return detached frames for playback; never commit gameplay from a draw or animation callback. Older activity fields are read only by migration; unfinished legacy combat is abandoned after winner selection, without executing obsolete rules.

Fixtures entering the gameplay aggregate follow the same snapshot boundary as
production. Convert an engine fixture with `battleSnapshot(createBattleState(...))`
before assigning it to a battle activity. Keep its RNG and callbacks in the
resolution context; do not cast executable `BattleState` into `BattleSnapshot`.
Pure engine tests can continue to use the execution shape directly.

---

## Campfire brewing and Transmutation visits

`run/room-visit-initialization.ts` initializes fixed visit offers using the saved events RNG stream inside the room-entry transaction. `navigation/alchemy-commands.ts` owns brewing, source/keyword selection, and transmutation actions against that committed visit. Campfire and Transmutation activities own offers, completion, and result cards; Transmutation also saves class-independent keyword choices, source snapshots and indices, fixed randomly selected source keywords, exact alteration previews, and source/keyword selections; the resume codec persists them independently of the visible menu. Returning or reloading must not regenerate an initialized visit.

Brew and alteration commands validate the current activity, completion, source eligibility, and selected offers before writing. Payment, deck replacement, discovery, and visit use commit synchronously through the run-session write port.

Campfire Rest and Brew are mutually exclusive. Campfire brewing selects the mixing flow when the deck has at least two eligible Potion instances, including previously strengthened or Mixed Potions. The player chooses two instances, inspects the preview, and confirms Mix. Otherwise, choosing one of the three saved offers immediately grants it. Both the screen and command enforce this choice. The Campfire route passes active room modifiers to the screen so Hidden Purse and Herbal Hearth rewards are acknowledged after Rest, including resume; brewing does not claim those Rest rewards. The Alchemist exposes Mix Potion and Distill as separate services sharing the existing price and once-per-visit brewing allowance.

Transmutation selects a source and previews its first compatible keyword immediately. Three keyword buttons above the original-to-preview comparison switch between saved alterations. One keyword comes from each of Damage, Buffs/Restoration (including Health and Leech), and Resources/Additions when the deck supports all three groups; unavailable groups use unique useful fallback choices. Back returns to the card picker without drawing RNG. Selection commands leave the deck unchanged; Transmute validates the source snapshot, fixed selection, and current eligibility, then atomically replaces that instance with the preview.

After a covering save, Transmutation reveals the completed card with the card-reward chime and waits for Continue. The result card remains inspectable; Continue advances without granting it again. Pending or failed saves keep choices locked and use the existing progress-save retry flow; a completed resume shows the saved result and Continue without altering again or replaying the reward chime. Mixed Potions, corrupted cards, and already-transmuted cards are ineligible; strengthened standard Potions are eligible. Visits with no valid alteration, and completed visits missing a result, advance automatically after offer initialization. A completed Labyrinth support visit clears its pending node through the existing progression flow.
