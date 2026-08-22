---
status: active
updated: 2026-08-22
---

# Simplification and consistency pass

## Objective

Remove dead surface area and duplicated invariants discovered during an exploration pass, so the run-flow victory/reward pipeline, mystery effects, effect handlers, audio facade, and test suite each have exactly one owner per rule. No behavior changes except where noted; every item keeps existing tests green or relocates them to their topical home.

## Findings summary

| #   | Finding                                                                                                                        | Kind                           | Key evidence                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1   | `VictoryRewardsResult` carries 7 fields no consumer reads                                                                      | Dead payload                   | `victory-flow-types.ts:36-50`; consumers read only 6 fields                                              |
| 2   | `createRunFlowHandlers` exposes 3 entries whose only consumers are tests reaching past the composition                         | Dead surface                   | `run-flow-handlers.ts:23-25`; sole production consumer `use-run-flow-engine.ts` never touches them       |
| 3   | Mystery effects re-implement deck/trinket discovery mutations and inject 15 context fields that are all derivable from `draft` | Duplication / over-engineering | `mystery-flow.ts:26-48,89-92,157-163` vs `deck-mutations.ts:10-18`                                       |
| 4   | `removeAll` on `cleanse-player-status-to-damage` is authored on a card and typed, but the handler ignores it                   | Drift trap (no-op knob)        | schema `status-schemas.ts:58`, card `cards/library/cards.ts:203`, handler `status-handlers.ts:91-106`    |
| 5   | Reward route transition: byte-identical switch cases + three different claim-release mechanisms for the same rule              | Accidental inconsistency       | `run-flow-rewards.ts:56-61,146-184`                                                                      |
| 6   | Reward "carry-forward" trio copied by hand in four places                                                                      | Duplication                    | `reward-flow.ts:37-44,83-93`; `pending-reward-persistence.ts:90-98,134-145`                              |
| 7   | Test suite: no central mock lifecycle, triplicated module mocks, local fixture wrappers duplicating the canonical one          | Test hygiene                   | `vite.config.ts:131-162`; three run-domain tests; two byte-identical `makeState` copies                  |
| 8   | Audio facade bypassed once; fade loop duplicated internally; clamp discipline inconsistent                                     | Polish                         | `use-app-effects.ts:21-22,116`; `audio-music.ts:137-153,170-189`; `audio-sfx.ts:41` vs `audio-volume.ts` |

## Implementation sequence

### Phase 1 — Victory payload and handler surface

1. **Shrink `VictoryRewardsResult`** (`src/features/alchemy/run-loop/navigation/victory-flow-types.ts`).
   - Keep only consumed fields: `goldEarned`, `playerHealth`, `maxHealthDelta`, `rewardState`, `labyrinthRewardModifiers`, `destinationOfferState`.
   - Delete `newGold`, `destinations`, `materials`, `baseGold`, `eliteBonus`, `bossBonus`, `generousBonus` from the interface and both construction sites (`victory-flow.ts` wildwood branch ~151-165 and labyrinth branch ~233-247). The values stay as locals where computation needs them (`newGold` feeds `getAvailableDestinations`; bonuses feed `computeVictoryRewardState`). Also drop the unread `unmultipliedTotal` field from `computeVictoryGold`'s return (`reward-math.ts:106`) while keeping the local.
   - Fix the stale "Depended on by: useRunFlowEngine" header comment on `computeVictoryRewardState`.
2. **Trim `createRunFlowHandlers`** (`run-flow-handlers.ts`).
   - Remove `clearCombatState`, `awardRunEndMaterials`, `commitVictoryResult` keys. The first two are module re-exports, not composed handlers; the third is internal to `handleBattleVictory`.
   - Update `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts` to import `awardRunEndMaterials`/`clearCombatState` from `run-flow-session-helpers` and drive `commitVictoryResult` via `handleBattleVictory`'s owning module (`createVictoryHandlers`), matching how production consumes them.

### Phase 2 — Mystery flow consolidation

3. **Collapse `MysteryEffectContext`** (`navigation/mystery-flow.ts`).
   - Import the write-port setters (`setRunDeck`, `setRunGold`, `setRunPlayerHealth`, `setRunTrinkets`, `setMysteryCardChoices`, `setMysteryGrantedTrinketIds`, `setMysteryGrantedGearInstances`) and `awardMysteryXP` directly, as sibling modules (`deck-mutations.ts`, `use-mystery-event-navigation.ts:116`) already do. Delete the forwarding wrapper `mutate()` (~46-48).
   - Reduce the injected context to what genuinely varies: `{ draft, rng }`. Derive `runMaxHealth`, `ownedTrinketIds`, `gearAstralChanceBonus` from `draft` at use time.
   - ~~Preserve semantics: capture `runDeck` once at dispatch entry~~ **Deviation (accepted in review):** the implementation reads `draft.run.activeRun.runDeck` live inside `offerMysteryCardChoices`. Accepted because the deck only drives keyword-affinity weighting, no authored event pairs a deck-mutating effect before `chooseCard` (the kind appears in no pool entry), and the live read stays correct if one ever does.
   - Replace `addCardToRun` (~89-92) and the body of `gainMysteryTrinket` (~157-163) with calls to `appendCardToRunWithDiscovery` / `appendTrinketToRunWithDiscovery` so the discovery invariant has one owner.
   - Update `use-mystery-event-navigation.ts:70-94` to pass only `{ draft, rng }`.

### Phase 3 — Effect-handler honesty and twins

4. **Delete the no-op `removeAll` from `cleanse-player-status-to-damage`**: remove from `status-schemas.ts:58`, `types.ts:120`, and the authored card `cards/library/cards.ts:203`. The kind's meaning ("cleanse the named status fully, deal damage") already implies full removal; `remove-harmful-status` keeps its meaningful `removeAll`. Run the description-parity and content-validation suites to confirm no drift.
5. **Unite the twin self-damage handlers**: extract a shared `dealSelfDamage(state, amount, statLabel, combatTexts)` used by `applySelfDamageEffect` (`damage-handlers.ts:15-28`) and `applyLoseHealthEffect` (`mana-health-handlers.ts:100-113`); differences stay at call sites (extra status application, stat label).
6. **Small cleanups in the same files**: shared `zeroPlayerStatus(state, status)` for the identical spread-and-zero blocks (`status-handlers.ts:66-71,102-106`); delete dead `chanceEffectDefinition`/`repeatOverTurnsEffectDefinition` and their `void` suppressors (`recursive-definition.ts`, `schemas.ts:26-27`).

### Phase 4 — Reward route consistency

7. **`run-flow-rewards.ts` route transition**:
   - Merge the byte-identical `LABYRINTH_VICTORY`/`WILDWOOD_VICTORY` cases (56-61) into one fall-through case.
   - Give every route the same claim-release mechanism: promote the wildwood path's `settleClaimSurface` closure into the single release helper wrapped around each route's completion callback, replacing the three inline wrappers (164-182). The `ACT_COMPLETE` comment (offer-state overwrite) moves onto the helper.
8. **Carry-forward trio**: make `finalizeRewardState`'s companion branch build on `createNextRewardState` (`{ ...createNextRewardState(rewardState), choices: companionRewardCards, clearCompanionRewardCards: true }` — after confirming `createEmptyRewardState` defaults match the hand-built fields `gold: 0`, `materials: emptyInventory()`, `selectedId: null`, `rewardType: "card"`), and apply the same base-spread in both restore paths of `pending-reward-persistence.ts` so the shared-field set is written in exactly one function.

### Phase 5 — Test infrastructure

9. **Centralize mock lifecycle**: set `restoreMocks: true` (and consider `clearMocks: true`) in the vitest section of `vite.config.ts`; delete the ~32 manual `afterEach(() => vi.restore/clear...)` hooks. Spot-check suites that intentionally clear specific mocks mid-test (e.g., `turn-resolution-ui.test.ts`) keep working.
10. **Share the triplicated mocks**: add `tests/helpers/mock-flush-save.ts` alongside the existing `mock-audio.ts`; switch `run-domain-resume/session/progress.test.ts` to the shared modules instead of inline `vi.mock` blocks.
11. **Fixture drift**: extend `tests/fixtures/battle.ts` `makeState` with the seeded-rng variant (`rng: () => 0.99`) the duplicated locals encode; delete the local wrappers in `gear-new-affixes.test.ts`, `burn-stun-resolve.test.ts`, `card-play.test.ts`, `apply-effects-special.test.ts`, `block-decay.test.ts`, `cost.test.ts`.

- **Partial by design:** only the rng-variant wrappers were deleted (`gear-new-affixes`, `burn-stun-resolve` via `makeStateWithFailedRolls`). `card-play`, `apply-effects-special`, `block-decay`, and `cost` keep local `makeState` wrappers because they encode genuine per-suite defaults (mana tiers, enemyMaxHealth sync, block stacks) the shared fixture should not absorb.

12. **Relocate stranded coverage**: move the phoenixFeather `describe` block from `apply-effects.test.ts:103` into `apply-player-combat-damage.test.ts`, the topical home for `applyPlayerCombatDamage`.

### Phase 6 — Audio polish

13. **Close the facade bypass**: expose `getBossMusicKey`, cache invalidation, and a `resumeMusicIfPaused()`-style function through `lib/audio.ts`; switch `use-app-effects.ts` off direct `audio-state`/`audio-music` imports (the only deep consumer).
14. **Single volume ramp**: unify the two interval pumps in `audio-music.ts` (`startTrack` fade-in, `fadeOutAndStartTrack` crossfade) behind one token-guarded ramp helper.
15. **One clamp convention**: use `clamp()` from utils in `audio-sfx.ts:41`; clamp the final product in `applyMusicVolume` rather than relying on the implicit `MUSIC_MASTER_GAIN × boss boost ≤ 1` headroom invariant.

## Out of scope

- The in-flight dirty docs work (`AGENTS.md`, `docs/REFERENCE.md`, `docs/WORKFLOWS.md`) — untouched.
- The deliberate kind-guard boilerplate in battle effect handlers and the shared idle-batching abstraction across audio/image preload (evaluated, not worth the churn).
- Ordering difference between `prepareNextDestination` (navigate → commit-on-render) and `advanceToNextDestination` (commit → navigate): appears intentional per-flow timing; documented here rather than unified without stronger evidence.

## Verification

- Per phase: `npm run verify:changed` scoped to touched paths.
- Content phases (4, 7, 8): description-parity and content-validation suites must stay green.
- Full gate before handoff: `npm run check:push` (format, typecheck, lint, build, pre-push e2e subset) or `check:ship` if e2e is deferred.
- Behavior-preservation spot checks: victory gold/material numbers unchanged (balance sim smoke via `balance:sim` optional), mystery card/trinket grants still register compendium discovery, save/resume through an interrupted reward still restores claim state.
