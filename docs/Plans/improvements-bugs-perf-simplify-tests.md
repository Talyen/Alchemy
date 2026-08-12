# Plan: Bug, Performance, Complexity, and Test Improvements

## Overview

Exploration pass over the codebase surfaced verified improvements in four
categories. Each item below states the evidence (file:line), the impact, the
proposed change, and the verification gate. Items are ordered by value within
each category. None require new packages, save-format changes, or new
architectural seams.

Legend for verification: **E2E** = `npm run test:e2e:prepush` (or the tagged
spec); **Unit** = path-scoped Vitest from CONTRIBUTING.md § What to run when
you change…; **static** = `npm run typecheck` + `npm run lint`.

---

## 1. Bugs

### 1.1 Destination picker after non-combat destinations samples as act slot 0

**Evidence**

- `src/features/alchemy/run-loop/run/run-flow-progression.ts:110` —
  `advanceToNextDestination()` calls `prepareNextDestination()` with no
  argument, so the default `destinationIndexInAct = 0` (`:39`) is used.
- `advanceToNextDestination` is the `handleContinue` for shop (merchant /
  alchemist / trinket / equipment) continues and the mystery continue
  (`use-alchemy-run-controller.ts:199,208,216,223`), i.e. every non-combat
  destination exit.
- `resolve-available-destinations.ts:19` — `options.destinationIndexInAct ??
input.destinationIndexInAct` means the passed `0` overrides the run's live
  index, which was already incremented by `commitDestinationClaim`
  (`run-session-write-port.ts:217`).
- Also routes through `advanceToNextDestination`: the campfire continue
  (`run-flow-destination-screen.ts:57`). The mystery continue is
  `use-alchemy-run-controller.ts:232` (`handleMysteryContinue`, which calls
  `advanceToNextDestination`); `:199,208,216,223` are the four shop continues.
- The battle-win path is correct: `victory-flow.ts:217-222` passes the live
  `input.destinationIndexInAct`.

**Impact** (two concrete consequences, both stemming from sampling as slot 0):

1. The boss gate `destinationIndexInAct >= DESTINATIONS_PER_ACT - 1`
   (`destination-flow.ts:81`, `DESTINATIONS_PER_ACT = 8` at
   `src/lib/game-constants/run-rewards.ts:43`) never fires on post-shop /
   post-mystery pickers. When
   slot 7 (index 6) is a non-combat node, the next picker offers normal
   destinations instead of the boss, so the act can run one destination past
   its 8-slot design.
2. `getPreviousDestination(0, …)` returns `undefined`
   (`campaign-start.ts:11`), so the "no Corruption after Corruption" rule
   (`destination-flow.ts:85-87`) is silently disabled on those pickers,
   inconsistent with the victory-flow path.

**Change** — In `advanceToNextDestination()`'s `afterCommit`, call
`prepareNextDestination(deps.run.destinationIndexInAct)` instead of the
default. Note: `deps.run` is **not** a live getter — it is the React-bound
`RunOrchestrationPort` snapshot from `useRunOrchestrationPort()`
(`run-session-react-ports.ts:61-75`). It is current in the shop / mystery /
campfire flows only because the shell re-rendered on the `destinationIndexInAct`
bump during navigation. More robust: make `prepareNextDestination` default its
index to the draft's live value (`destinationIndexInAct ??
draft.run.activeRun.destinationIndexInAct`) so chained `afterCommit` flows
(campfire → advance → prepare) cannot read a stale snapshot; the only deliberate
`0` (act complete, `:86`) stays as-is.

**Verification** — Unit: `tests/features/alchemy/run-loop/*`,
`tests/features/alchemy/shell/*`, `run-domain.test.ts`
(run navigation paths). Add a focused unit test pinning that a continue after
the 7th slot (index 6) offers `BOSS_COMBAT`, and that a
previous-destination Corruption suppresses Corruption on the non-combat
picker. E2E: `tests/menu-navigation.spec.ts` / `core-gameplay.spec.ts` plus
`npm run test:e2e:prepush`.

---

### 1.2 Combat text for Lucky Clover and Holy Tithe shows pre-scaled gold

**Evidence**

- `src/lib/battle/trinket-effects.ts:46-48` (`applyLuckyCloverGold`) and
  `src/lib/battle/damage-rider-leech.ts:147-148` (`applyHolyTithe`) emit
  `amount: damage`, but the actual gold is granted via `addGold`, which
  internally applies `scaleGoldReward` (`types/state-helpers.ts:116-117`,
  `:232-234`).
- The two other gold-grant paths already display the scaled amount:
  `gear-effects.ts:22-25` (`applyGearKillRewards`) and `wish.ts:81-88`
  (`applyWishGoldTriggers`).

**Impact** — With any `goldGainPercent` gear, the floating "+N gold" combat
text understates the gold actually added to the run. Display-vs-actual
mismatch in the same codebase family.

**Change** — In both helpers, scale before emitting: `const scaled =
scaleGoldReward(damage, state.gearEffects)` and emit `amount: scaled`
(keep `addGold(state, damage)` — it scales internally, matching wish/gear
behavior). Do **not** pass pre-scaled gold into `addGold` (would double-scale).

**Verification** — Unit: `tests/lib/battle` (trinket/damage-rider tests).
Add a case with `gearEffects.goldGainPercent > 0` asserting combat text
matches the run gold delta. Static: `npm run typecheck`.

---

### 1.3 Stun CC triggers one stack earlier than documented

**Evidence**

- `src/lib/battle/status-cc.ts:49` and `:171` both bail when `stackValue <
threshold` and trigger at `stackValue >= threshold` — the same `>=` as
  freeze.
- Documented intent: `game-constants/combat.ts:8-9` — "Stun when stacks
  **exceed** this fraction" and "Freeze uses `>=` vs stun's `>`". The
  parenthetical "(equivalent at integer Health)" is only true for odd health
  (e.g. health 31 → threshold 15.5); at even health (30 → 15) stun fires at
  15 instead of 16.
- Freeze's boundary is pinned by a test (`damage.test.ts:358`, "15 >= 15 →
  triggers"); stun's boundary is not (its test uses 17, `:315`).

**Impact** — Low-severity gameplay boundary drift for stun only at even
max-health values. Fixing it is a player-facing balance change (one stack
later), so treat as a **decision item**: option A is correct the code to `>`
for stun only and pin the boundary in a test; option B is accept `>=` and
fix the stale comment in `combat.ts` + add a pinning test so the behavior is
intentional and documented. Note option A is not a one-char change: stun and
freeze share the same threshold checks (`resolvePlayerCrowdControlTrigger`,
`status-cc.ts:46-84`, and the stat-agnostic `tryTriggerEnemyCc`, `:169-175`),
so it needs a `stat` branch in both plus a caller audit.

**Verification** — Unit: `tests/lib/battle` status-cc tests; add boundary
cases at even health (30) for both stun (`>` behavior) and freeze (`>=`
behavior unchanged).

---

## 2. Performance

### 2.1 `playableHandCardKeys` new-Set identity re-renders every hand card per battle commit

**Evidence**

- `src/app/screen-routes/use-battle-screen-route-data.ts:61-64` memoizes on
  the whole `battleState` object, which is a new object on **every** battle
  commit (Immer).
- The Set is threaded to every `HandCardItem` (`hand.tsx:46`), read as
  `playableHandCardKeys.has(cardKey)` (`hand.tsx:58`); the prop identity
  change defeats React Compiler element memoization, so all ~7 hand cards
  re-render on commits that never touch the hand (companion follow-ups,
  status ticks, gold steals).
- `getPlayableHandCardKeys` (`run-loop/battle/playable-hand.ts:4-21`) only reads
  `hand`, `turnPhase`, `mana`, `wishOptions`, `flags`, `talentEffects`,
  `trinketEffects` — none of which change on most commits.

**Change** — Narrow the memo: either (a) key the memo on the exact fields
above instead of `battleState`, or (b) compute a per-card primitive
`canPlay: boolean` in `BattleHand` keyed on the same narrow fields so
`HandCardItem` receives only stable/primitive props.

**Verification** — Static + path-scoped unit tests for `playable-hand`;
manually profile the `battle-effects` scenario with the perf harness
(`docs/PERFORMANCE.md`) before/after. E2E battle specs as regression.

---

### 2.2 Collection grid re-sorts and re-derives descriptions on every build

**Evidence**

- `collection-items.ts:81-83` `sortByTitle(cardLibrary)` runs a full
  `localeCompare` sort of the entire library on every `getCardItems` call;
  `getCollectionPageItems` is called inline, unmemoized from
  `collection-ui.tsx:36`.
- For each discovered card, `shapeCardItem` (`:105-115`) re-runs
  `getEffectiveCardDescriptionLines`, allocating an effect cursor and regex
  passes per line (`card-description.ts:45-54`).

**Impact** — Full-library sort + per-card description re-derivation on every
tab switch and page change in the collection.

**Change** — Pre-sort all three catalogs once at module load (`cardLibrary`,
`enemyBestiary`, `trinketLibrary` — every `getCardItems`/`getBestiaryItems`/
`getTrinketItems` call sorts on the way through `collection-items.ts:112,119,139`),
and `useMemo` the shaped page
items in `CollectionGrid` keyed on `(tab, page, discovery arrays,
bondedCompanions)`. The memo only pays off if the discovery arrays have
stable identities across renders (store-backed, not freshly allocated).

**Verification** — Static; existing collection unit tests
(`tests/features/alchemy/shared/ui/*`).

---

### 2.3 Card pools re-filter the full library on every call

**Evidence** — `card-pools.ts:10-16` — `getOfferableCardPool` and
`getStandardPotionPool` each do a linear `cardLibrary.filter` on every
invocation (reward flow `reward-flow.ts:69,227,256,264`, draft screen,
`validate-startup.ts:28`). The content is static.

**Change** — Build both pools once at module scope (or lazy-once getters) in
`card-pools.ts`. Public API unchanged. Safe: `mystery-flow.test.ts` spies on
`getOfferableCardPool` at the function boundary, so the mock still applies.

**Verification** — Static; existing reward-flow tests.

---

### 2.4 App shell re-renders on every battle commit

**Evidence** — `src/App.tsx:86` subscribes to the full battle slice
(`run-session-model.ts:67-69`) and reads only `battleState.enemyHealth` /
`enemyType` (`App.tsx:100,126`) in render, so every card-play/draw/enemy-hit
commit re-renders the shell wrappers and `GameMenuOverlay`.

**Change** — Replace the coarse subscription with narrow selectors for
`enemyHealth` and `enemyType` (and any other field actually read), deriving
`isAutosaveAllowed` / `isBossBattle` from those.

**Verification** — Static; `tests/app/*` hooks tests; boot E2E
(`alchemy.spec.ts`).

---

### 2.5 Presentation-store churn re-renders the whole battle route

**Evidence** — `use-battle-screen-route-data.ts:17-31` bundles all 11
presentation fields in one `useShallow` selector; the timer-driven
`floatingCombatTexts` add/remove (`battle-presentation-store.ts:148-155`)
commits ~2× per text, and each commit re-runs the whole `BattleScreen`
subtree (dense multi-lane card plays produce a burst of a dozen-plus
re-renders over ~2s).

**Change** — Co-locate the high-frequency reads: give `CombatTextRail` its own
direct `floatingCombatTexts` subscription (both instances), and isolate
shake/flash tokens into small self-subscribing widgets so `BattleScreen`
only receives the rarely-changing structural fields.

**Verification** — Static; battle E2E specs; perf harness on `battle-effects`
before/after.

---

### 2.6 Background-particles rAF loop runs continuously on static screens

**Evidence** — `src/lib/animation/background-particles.ts:186-212` runs
`clearRect` + ~40 `ctx.arc`/`fill` calls at 60 fps on every non-battle screen
(`app-overlays.tsx:25-32`), with no idle gating.

**Change** — Pause the loop when `document.hasFocus()` is false (or the
canvas has zero size), resuming on focus — mirroring the existing audio mute
logic.

**Verification** — Static; visual check on menu/options screens; not covered
by CI (documented on-demand perf work).

---

## 3. Simplify over-engineered code

### 3.1 `formatCompanionTurnStartLine` duplicated verbatim

**Evidence** — Identical bodies in
`shared/utils/companion-turn-line.ts:9-19` and `lib/game-data/card-description.ts:56-66`.
The shared utils version is reached by `companion-panel.tsx`; the private copy
is used by `getEffectiveCardDescriptionLines`.

**Change** — Keep one copy in `src/lib/game-data/cards/companion-turn-description.ts`
(which already owns `formatCompanionTurnLineBase`), delete
`shared/utils/companion-turn-line.ts`, and re-export the function from
`shared/utils/index.ts` so callers don't move. Prevents silent drift between
card text and tooltip.

**Verification** — Static (`typecheck`, `lint:boundaries`); card-description
and companion-panel unit tests.

---

### 3.2 Two forked canvas particle engines

**Evidence** — `src/lib/animation/particle-burst.ts` (`animateParticles` +
`stepParticle`, `:57-120`) and `src/lib/animation/hurt-sparks.ts`
(`animateHurtSparks` + `stepHurtSpark`, `:78-131`) share ~85% identical RAF
scaffolding (running flag, dt clamp, progress, alpha decay, clearRect, cancel
closure). Only friction (0.97 vs 0.94), alpha curve exponent, and draw
(`globalAlpha` vs `save/restore`) differ.

**Change** — Extract one shared `animateParticles(ctx, particles, duration,
step, draw, onComplete)` loop core in `lib/animation`; the two engines supply
their step/draw callbacks. No new public surface beyond the shared core.

**Verification** — Static; visual smoke of card-burst and hurt-spark effects
(`ParticleBurst.tsx`, `hurt-spark-burst.tsx`).

---

### 3.3 `sampleItems` vs `pickEncounterTraits` — shuffle-take-N written twice

**Evidence** — Identical `shuffle(items, rng).slice(0, Math.min(count,
items.length))` in `shared/utils/random.ts:6-8` and
`lib/content-systems/encounter-traits.ts:111`, plus the same pattern inlined
at `reward-flow.ts:79` and `lib/balance/class-deck.ts:61`.

**Change** — Move `sampleItems` next to `shuffle` in `src/lib/utils.ts`, keep
the `shared/utils` re-export for feature callers, and switch the other three
sites to it.

**Verification** — Static; reward-flow / encounter-trait unit tests.

---

### 3.4 `lib/ui/progress.ts` config table for a one-line clamp

**Evidence** — `PROGRESS_CONFIG` (`lib/ui/progress.ts:5-13`) feeds the single
function `clampProgressPercent`, which has one caller
(`components/ui/progress.tsx:30`). `clamp` already exists in `lib/utils.ts:13`.

**Change** — Delete `lib/ui/progress.ts`; inline
`clamp(Number.isNaN(value) ? 0 : value ?? 0, 0, 100)` in
`components/ui/progress.tsx`; fold `tests/lib/ui/progress.test.ts` into the
component test.

**Verification** — Static; progress component test.

---

### 3.5 `randomInt` in `lib/utils.ts` has one caller

**Evidence** — `randomInt` (`lib/utils.ts:18-20`) is only called at
`victory-flow.ts:73`; the general-purpose `pickRandom` is used everywhere
else.

**Change** — Inline the one-liner at `victory-flow.ts:73` and remove
`randomInt` from the util surface. (Low value; optional — keeps `lib/utils`
tight.) The victory-flow test currently pins `randomInt` via `vi.fn`
(`victory-flow.test.ts:22`); inlining makes that mock dead, so seed the
passed-in `rng` in the test instead.

**Verification** — Static; victory-flow test (mocks the module already).

---

## 4. Tests — optimize and de-duplicate

### 4.1 E2E card-reward test walks a full battle unnecessarily

**Evidence** — `tests/shop-and-rewards.spec.ts:125-147` bootstraps
`startBattleWithDeck` → `winViaCombat` (the most expensive E2E primitive,
multi-turn `endTurn` settle polls) to assert only the reward-UI gate
(disabled → select → enabled → destination). Its two siblings (`:149-186`,
`:188-222`) assert the same gate via `injectSaveState` +
`primaryRewardInterruptedFlow` with no battle. The real battle→reward
transition is covered by `tests/run-outcomes.spec.ts` (Act I boss).

**Change** — Convert `:125-147` to `injectSaveState({ currentScreen:
"rewards", interruptedFlow: primaryRewardInterruptedFlow({ rewardType:
"card", ... }) })`, mirroring its siblings. Keep Elite Combat
(`core-gameplay.spec.ts`) and Act I boss as the battle→reward coverage.

**Verification** — E2E: the trimmed spec + full `npm run test:e2e:prepush`.

---

### 4.2 Defensive-guard tests duplicated verbatim between base and integration suites

**Evidence** — `tests/lib/battle/card-play.test.ts:110-115` (enemy already 0)
≡ `tests/lib/battle/integration/card-play.test.ts:261-266`; `:117-127` (player
defeated) ≡ `:296-306`. Identical inputs and `expect(result.state).toBe(state)`.

**Change** — Delete the two `it` blocks from the integration file; the base
file is the canonical home for the guards. Keep the integration file's
"allowAfterEnemyDefeat" and killing-blow tests (different behavior).

**Verification** — Unit: `tests/lib/battle` + integration suite.

---

### 4.3 Loose E2E copies of unit-pinned mechanics

**Evidence**

- Restore-mana overflow asserted three ways: `apply-effects.test.ts:56-62`,
  `card-play.test.ts:51-57`, and `core-gameplay.spec.ts:43-61`.
- Block-absorb-then-halve: exact in `block-decay.test.ts:25-60`, loose
  (`hpLost >= 0 && <= 5`) in `alchemy.spec.ts:16-32` — the E2E would pass even
  if block were broken.

**Change** — Drop the loose `core-gameplay.spec.ts:43-61` overflow test (keep
the end-turn test, which also covers card play decrementing the hand).
For `alchemy.spec.ts:17-32`, either tighten the assertion to a real expected
range or delete it in favor of the exact unit coverage — recommend deletion,
as block decay is fully pinned at unit level and the E2E adds a false-sense
signal.

**Verification** — E2E: boot + core gameplay specs; full `@prepush`.

---

### 4.4 Five divergent local card/makeState factories re-implement shared fixtures

**Evidence**

- `tests/lib/battle/damage-test-helpers.ts:29-30` `makeTexts()` ≡
  `tests/fixtures/battle.ts:11-13` `makeCombatTexts()`; `makeCard` there
  (`:4-14`) duplicates `tests/fixtures/cards.ts:4-18` `makeTestCard`.
- Local `makeCard` copies in `card-description.test.ts:5-15`,
  `corruption.test.ts:16-27`, `create-shop-actions.test.ts:60-70`,
  `utils-dom.test.ts:11` (some already drifted from the fixture).
- Identical `makeState` forwarders in `apply-effects.test.ts:10`,
  `apply-effects-special.test.ts:8`, `card-play.test.ts:7`,
  `damage-riders.test.ts:13` — the integration suite already shares one
  (`integration/helpers.ts:5-15`).
- Third layer: `integration/helpers.ts:17` `export const makeCard =
makeTestCard` re-export shim.

**Change** — Delete `tests/lib/battle/damage-test-helpers.ts`; move its only
unique helper (`makeEffect`, `:16-27`) into `tests/fixtures/battle.ts`; point
the 10 importers at `fixtures/battle`/`fixtures/cards`. Export one shared
`makeState` (mana-10 default) from `tests/fixtures/battle.ts` and delete the
four local wrappers. Replace the local `makeCard`s with
`makeTestCard`/`makeTestCardWithId`. Note: the local `makeCard` default is a
damage effect (`{kind:"damage",...}`) while `makeTestCard` defaults to
`effects: []` — callers that relied on the implicit damage default must pass
`effects` explicitly. Delete the `integration/helpers.ts`
re-export. Keep `cost.test.ts` / `block-decay.test.ts` signatures (genuinely
different).

**Verification** — Unit: run the full `tests/lib/battle` and touched feature
suites.

---

### 4.5 Wall-clock timing assertion in an E2E spec

**Evidence** — `tests/menu-navigation.spec.ts:226-237` asserts
`elapsed >= 300` from `Date.now()` around a page load — timing-dependent and
flake-prone under CI load; it tests an arbitrary constant.

**Change** — Delete the wall-clock test. Asserting the loading-progress
element's presence instead would duplicate the sibling test at `:217-224`,
and the minimum-display-duration behavior is already unit-pinned in
`tests/app/use-initial-load-ready.test.ts` (fake timers). The timing test
adds a false-sense flake signal with no unique coverage.

**Verification** — E2E: `menu-navigation.spec.ts`.

---

## Scope / risks

- **Not included:** dead-code-only findings (already covered by the DeadCode
  audit), armory/battle drag math consolidation (no demonstrated drift),
  `randomInt` (optional micro), oversized `end-player-turn.test.ts` split
  (recommend deferring — it is a big mechanical move with no correctness
  gain). These are called out here so future passes don't re-litigate.
- **Decision required:** 1.3 (stun boundary) is a player-facing balance
  change; confirm A (fix code to `>`) vs B (document `>=`). **Decided: B**
  (accept `>=`, fix comment, pin boundary).
- **1.1 touches run navigation:** the fix restores documented behavior rather
  than changing a shipped invariant, but verify with the run-navigation E2E
  subset and `run-domain` tests before push.

## Execution order

1. Bugs (1.1, 1.2, 1.3) — smallest, highest-certainty wins; unit-verify each.
2. Perf (2.1-2.6) — each is self-contained; 2.1 and 2.2 first (largest win).
3. Simplify (3.1-3.5) — pure refactors; run `lint:boundaries` after 3.1/3.3.
4. Tests (4.1-4.5) — last, since they trim E2E runtime that perf changes
   also affect; re-run full `@prepush` once after all E2E-adjacent edits.
