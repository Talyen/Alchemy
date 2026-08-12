# Plan: Round 2 — Bug, Performance, Complexity, and Test Improvements

## Overview

A fresh exploration pass over the codebase surfaced a second batch of verified
improvements. Round 1 (`docs/Plans/improvements-bugs-perf-simplify-tests.md`)
is already implemented in the working tree; none of its items are repeated here.
Every item below was verified by reading the code and its callers (evidence =
`file:line`). None require new packages, save-format changes, or new
architectural seams.

Legend for verification: **E2E** = `npm run test:e2e:prepush` (or the tagged
spec); **Unit** = path-scoped Vitest from CONTRIBUTING.md § What to run when
you change…; **static** = `npm run typecheck` + `npm run lint`.

> **Implementation status (Round 2):** all items below are implemented and
> verified. Full unit suite (290 files / 3050 tests), `typecheck`, `lint`,
> `lint:boundaries`, and the touched E2E specs (combat-mechanics, difficulty-
> select, gear-combat, run-outcomes, menu-navigation, wildwood, save-persistence)
> pass. Deviations from the plan as written:
>
> - **1.1** landed as option **B** (wildwood crystal wish outcome rerouted to
>   gold via a new `contentSystemType` field on `BattleState`).
> - **2.3** landed as the **debounce-raise** fallback (not the mid-battle skip),
>   because `save-persistence.spec.ts` requires mid-battle persistence for the
>   reload-resume contract; the skip would break it.
> - **4.1** kept two battles (burn + bleed) — burn's "chip persists" fact is
>   distinct from bleed's "chip clears".
> - **4.11** polls `listSaveCandidates()` (no `readSave` API exists on the
>   desktop bridge; a content poll would need a new IPC seam).
> - **4.12** converted and verified — the reward screen hydrates from a
>   `phase: "reward"` `wildwoodDraft`, so the boss gauntlet boot is gone.
> - **3.7** deleted `shuffleCards`; its unit tests were repointed at `shuffle`
>   from `@/lib/utils`.

---

## 1. Bugs

### 1.1 Wildwood victory silently drops `pendingMaterials.crystal` from wish triggers

**Evidence**

- `src/lib/battle/wish.ts:102-114` — `applyWishCrystalGoldTrigger` writes the
  crystal outcome into `pendingMaterials.crystal` on a `wishCrystalGold` talent
  proc during **any** battle, including Wildwood.
- `victory-flow.ts:271-273` — `commitVictoryRewards` awards
  `battleState.pendingMaterials` only when `contentSystemType !== WILDWOOD`.
  `run-loop/run/run-flow-rewards.ts:66` skips material award for wildwood the
  same way.
- `run-loop/run/run-flow-victory.ts:56-67` — wildwood victories route through
  `commitVictoryRewards`; `commitWildwoodVictory` does not touch
  `pendingMaterials` (grep: the field is written in only two places, wish and
  battle-setup-defaults).

**Impact** — `battle-init.ts:37` merges unlocked talents into every battle
(including Wildwood), so `wishCrystalGold` is live in wildwood. A player who
rolls the crystal wish outcome during a wildwood boss loses the crystal
permanently — a real resource loss on a rare trigger, with no combat text or
UI signal that it was discarded.

**Change** — Two options:

- **A:** honor `pendingMaterials` in wildwood — remove the `!== WILDWOOD` guard
  at `victory-flow.ts:271` and make `run-flow-rewards.ts:66` consistent (grant
  `result.materials` too, or explicitly drain `pendingMaterials`). This changes
  the product model (wildwood would start paying run materials) and needs design
  sign-off.
- **B (preferred):** disable the leak by rerouting the crystal outcome in
  wildwood — `applyWishCrystalGoldTrigger` is a coin-flip between gold and
  crystal (`wish.ts:105-113`), and gold already works in wildwood
  (`addRunGold` is unconditional at `victory-flow.ts:275`), so suppress only the
  crystal/`pendingMaterials` branch and grant the value as gold instead. No
  reward is promised and dropped.

Recommend B. The two independent `!== WILDWOOD` guards (victory-flow +
run-flow-rewards) show the design intent is "wildwood does not pay run
materials"; A is a product change, not a bug fix. Do not leave a silent drop.

**Verification** — Unit: `tests/lib/battle/wish.test.ts` +
`tests/features/alchemy/run-loop/navigation/victory-flow.test.ts` (add a wildwood
case asserting the crystal either reaches the run or is never generated). E2E:
`wildwood.spec.ts` + `@prepush`.

---

### 1.2 Alchemist Mix charges gold and consumes the one-time Mix even when the mix fails

**Evidence**

- `src/features/alchemy/run-loop/shop/alchemist-shop-commands.ts:71-101` —
  `mixPotions` spends gold (`:90`) and sets `mixUsed: true` (`:91`) **before**
  calling `tryCreateMixedPotion`; when it returns `null` the command still
  returns `{ committed: true, value: null }` (`:97`).
- `src/lib/alchemist/potion-mixer.ts:44-46, 88-93` — `createMixedPotion` throws
  (and `tryCreateMixedPotion` returns `null`) exactly when either source card is
  already a Mixed Potion. The command layer guards only indices, never card
  identity; the React screen (`alchemist-shop-screen.tsx:79`) masks the hole by
  filtering `MIXED_POTION_CARD_ID` in `selectMixCard`.

**Impact** — After one successful mix the run deck contains a Mixed Potion; any
future `mixPotions` call that selects it (bounds pass, identity does not) pays
the price and permanently disables the Mix service while producing nothing. A
fragile command boundary whose correctness depends on the UI filtering.

**Change** — Move the rejection into the command: bail with
`{ committed: false, value: null }` when `cardA.id === MIXED_POTION_CARD_ID ||
cardB.id === MIXED_POTION_CARD_ID` (or check `tryCreateMixedPotion` result
before `spendRunGold` / `mixUsed`). Keep the UI filter as a UX nicety.

**Verification** — Unit: `tests/features/alchemy/run-loop/shop/*` (add a
mixed-potion-in-range case asserting no gold spent and `mixUsed` unchanged).
Static: `npm run typecheck`.

---

### 1.3 Auto-end-turn misses cleanse-only dead hands and rescans on every battle commit

**Evidence**

- `src/features/alchemy/run-loop/battle/use-battle-auto-end-turn.ts:54` —
  `hasPlayableCard = state.hand.some((card) => state.mana >= computeEffectiveCost(...))`
  replicates only the cost half of `canPlayCard`.
- `src/lib/battle/card-play.ts:54, 73, 80` — `canPlayCard` also returns `false`
  for `cardHasOnlyCleanseEffect` (cleanse-only cards with nothing to cleanse) and
  for cards under `wishOptions`/hidden-hand rules. The auto-end-turn scheduler
  ignores those, so a cleanse-only hand never auto-ends.
- Perf overlap: `scheduleAutoEndTurnRaw` depends on the whole `battleState`
  (`:60`), so the effect at `:77-80` clears and re-runs `computeEffectiveCost`
  over the hand on **every** battle commit, including enemy-turn commits where a
  player action is impossible.

**Impact** — The auto-end-turn feature stalls on cleanse-only hands (manual End
Turn needed), and every battle commit does a small hand rescan + timer reset.

**Change** — Reuse `canPlayCard` semantics: replace the hand scan with a check
that no card passes `canPlayCard` (export the per-card predicate from
`card-play.ts` or call `canPlayCard(state, card, index)`), and memoize the scan
on `[state.hand, state.mana, state.turnPhase, state.wishOptions,
state.flags.hiddenHandCardKeys]` plus a `turnPhase !== "player"` early return so
enemy-phase commits don't reschedule.

**Verification** — Unit: `tests/features/alchemy/run-loop/battle/*` (auto-end-turn
spec, add a cleanse-only-hand case). Static; battle E2E specs as regression.

---

### 1.4 Self-damage status rider applies from raw amount, not actual damage lost

**Evidence**

- `src/lib/battle/effect-handlers/damage-handlers.ts:15-28` —
  `applySelfDamageEffect` computes `healthLost` and emits text from it, but line
  27 calls `addPlayerStatus(postDamage, effect.damageType, effect.amount)` using
  the **full** effect amount even when `applyPlayerCombatDamage` absorbed it
  (gear reduction, block, Death's Door floor).
- The enemy-side mirror (`status-player.ts` `applyPlayerDamageStatuses`, :133-157)
  uses `actualDamage`; `enemy-turn-attack.ts:229-231` documents the rider rule as
  "status equal to damage dealt."

**Impact** — A self-damage card (e.g. Cauterize) can grant Burn stacks when the
player lost 0 HP (reduction/Death's Door), inconsistent with the documented
"status equal to damage dealt" invariant and with every other rider.

**Change** — Apply status from `healthLost` instead of `effect.amount` (match the
enemy-side path). Confirm no card relies on the current behavior; the burn
amounts are 1-2 so blast radius is small.

**Verification** — Unit: `tests/lib/battle` (damage-handler cases with block /
Death's Door active). Static: `npm run typecheck`.

---

### 1.5 Holy-block combat text under-reports block actually gained

**Evidence**

- `src/lib/battle/damage-rider-leech.ts:134-139` — `applyDamageBlock` emits
  `amount: blockAmount` in text, then `addPlayerStatus(state, "block",
blockAmount)` silently adds `gearEffects.flatBlockGained` on top
  (`types/state-helpers.ts:55-61`).
- The stun path in the same family already includes `flatBlockGained` in the
  text (`status-stun-resolve.ts:47-52`), so this is a display/state divergence
  _within_ the codebase's own convention.

**Impact** — With `flatBlockGained` gear, the floating "+N Block" text understates
the block actually applied. Cosmetic math, same class the round-1 gold-text fix
(`trinket-effects.ts`) addressed.

**Change** — Emit `blockAmount + (state.gearEffects.flatBlockGained if positive)`
in the text, keeping `addPlayerStatus` as-is (single scaling point).

**Verification** — Unit: `tests/lib/battle` holy-block cases with
`flatBlockGained > 0` asserting text matches the run-state delta.

---

## 2. Performance

### 2.1 Enemy tooltip derivations run while the tooltip is closed

**Evidence**

- `src/features/alchemy/shared/ui/enemy-tooltip.tsx:50-54` — `formatEnemyAttackLines`
  and the trait flatten + `new Set(labyrinthModifiers)` run in the render body
  regardless of the `visible` prop.
- `actor-panel-helpers.tsx:37-47` renders `EnemyTooltip` unconditionally whenever
  `currentEnemy` is set, and `actor-panel.tsx:104-112` mounts it always; battle
  commits re-render `ArtPanel` (health/status changes) many times per turn.
- The codebase's own hovered-only convention lives at `card-button.tsx:96`
  (`visible ? build : []`).

**Impact** — The derivations run whenever `EnemyTooltip` re-renders — at least on
tooltip open and any render where prop identity is not stable — even though the
popup content is invisible. Small strings, but steady-state waste during every
battle, and it makes correctness depend on React Compiler prop-memoization
luck rather than an explicit gate.

**Change** — Gate the three derivations on `visible`
(`visible ? formatEnemyAttackLines(...) : []`, build the Set/trait lines
lazily), matching `card-button.tsx`. Optional: memo the `DescriptionLines` input
on `[entry, attackEffects, labyrinthModifiers]`.

**Verification** — Static; battle E2E specs (tooltip still opens correctly);
perf harness (`docs/PERFORMANCE.md`) spot-check on `battle-effects`.

---

### 2.2 Homestead companion tiles rebuild full card descriptions on every grid render

**Evidence**

- `src/features/alchemy/meta/screens/homestead/companion-node.tsx:52-66` — the
  tooltip factory calls `getEffectiveCardDescriptionLines(card, { companionBondLevels })`
  eagerly in the returned component body, whether or not the tile is hovered.
- `homestead-tile-node.tsx:47` — `HomesteadTileFrame` invokes
  `detailTooltip({ visible: hoveredItemId === id, ... })` for **every** tile on
  every render; `homestead-screen.tsx:52` holds `hoveredItemId` in state, so each
  hover change re-renders the whole grid.
- `card-description.ts:117-148` allocates an effect-cursor `Map` and regexes per
  line on each call.

**Impact** — Hovering across the homestead grid rebuilds ~6-9 companion
descriptions per mouse move — the same "hovered-only description" violation the
round-1 tree already fixed for battle cards and collection.

**Change** — Gate the call on `visible`
(`visible ? getEffectiveCardDescriptionLines(...) : []`), or lift
`getCompanionTooltip` per-tile with a `useMemo` keyed on
`[card, discovered, bondedCompanions]`.

**Verification** — Static; homestead E2E/screenshots; `tests/app/*` homestead
unit tests.

---

### 2.3 Full-save serialization lands during battle on every 500ms quiet gap

**Evidence**

- `src/app/use-app-save-state.ts:46-57` — `triggerSave` debounces 500ms, then
  `flush` runs `resolveActiveRunForSave` → `buildAlchemySaveDataFromStores`
  (entire save: active run + full `battleState` + profile + gear codecs) →
  `JSON.stringify` + storage write.
- `storage/persistence-coordinator.ts:33-38` — `subscribeAlchemyPersistence`
  subscribes to `subscribeRunSessionCommits`, which fires on **every** battle
  commit (card plays, draw sequences, enemy-turn begin/commit, DoT ticks).

**Impact** — During combat the debounce keeps resetting on every commit, so a
full main-thread serialization+write lands every ~500ms of quiet — a periodic
frame hitch on lower-end devices. Battle state is already checkpointed at
start/victory/defeat/transition boundaries.

**Change** — **Implemented: raise the debounce for battle-screen commits**
instead of skipping mid-battle flushes. `save-persistence.spec.ts` requires
mid-battle persistence (the reload-resume and enemy-resolution-continuation
tests poll for `activeCombat` written by a battle autosave), so a blanket skip
would break the crash-resume contract. Instead, `triggerSave` now reads the
committed run phase via a new `readRunPhase()` port and uses
`BATTLE_AUTOSAVE_DEBOUNCE_MS` (2500ms) while `phase === "battle"` and the normal
500ms elsewhere, so the full serialization lands ~5x less often during combat
while still persisting the freshest `battleState`. Terminal
`pagehide`/`visibilitychange` flushes are unaffected.

Implementation note: the debounce is chosen in `triggerSave` (the subscription
fires per battle commit and the screen is only known there), never suppressing
the terminal flush — that is the crash-resume path.

**Verification** — E2E: `save-persistence.spec.ts`, `save-error-paths.spec.ts`,
`test:ship:e2e`; perf harness on `battle-effects`.

---

### 2.4 `useHasAnyOwnedGear` flattens all inventories on every store commit

**Evidence**

- `src/features/alchemy/shared/stores/gear-store.ts:86-88` — the Zustand selector
  runs `flattenGearInventories(state.gear.inventories).length > 0` on every
  `useGameplayStateStore` commit (Zustand re-executes selectors per set), and
  battle commits are the highest-frequency writes.
- Consumers mount it on the app root: `src/app/app-overlays.tsx:74-76`
  (`useIsArmoryLocked`) and `screen-routes/meta-routes.tsx:28`.
- `src/lib/gear/types.ts:66-68` allocates a flat array over all five character
  inventories.

**Impact** — A small allocation + length check runs on the always-mounted app
shell for every battle commit even though gear cannot change mid-battle.

**Change** — Select the stable `state.gear.inventories` reference and derive the
boolean with `useMemo` in the hook body (flatten only runs when inventories
change).

**Verification** — Static; `tests/app/*` hook tests; boot E2E (`alchemy.spec.ts`).

---

### 2.5 `DescriptionLines` offset math is quadratic in the number of parts

**Evidence**

- `src/features/alchemy/shared/ui/card-description-ui.tsx:84` — per part,
  `parts.slice(0, index).reduce((acc, p) => acc + p.text.length, 0)` recomputes a
  running prefix sum; also `tokenizeDescription(line)` + `getCorruptedValueOffsets`
  (`:69-70`, allocates a Set) run per render of any popup.

**Impact** — Small (2-5 parts per line) but runs on every hovered popup render,
which battle commits retrigger; trivial to fix and it is the kind of micro-alloc
that shows up in the perf harness.

**Change** — Carry the running offset in a single `reduce` pass instead of
`slice+reduce` per part. Keep the rest of the component unchanged.

**Verification** — Static; collection/enemy-tooltip E2E specs.

---

## 3. Simplify over-engineered code

### 3.1 Generalized "deal scaled enemy damage" block, copy-pasted across battle helpers

**Evidence** — Five sites compute `multiplier → Math.round(base * multiplier) →
mergeCombatText({target:"enemy", kind:"damage", stat}) → clampHealth(...)` with
only the base source, stat string, and an optional rider differing:

- `src/lib/battle/damage-status-riders.ts:146-161` (`applyFrozenHeartDamage`)
- `src/lib/battle/status-stun-resolve.ts:63-79` (`applyStunTrinketEffects`, adds
  lucky-clover gold)
- `src/lib/battle/wish.ts:165-185` (`applyWishBurnTrigger`, adds frozen-gear
  multiplier, health threshold, kill rewards)
- `effect-handlers/mana-health-handlers.ts:43-53` (`loseMaxMana` burn on crystal
  loss)
- The shared shape already exists in `gear-effects.ts:50-76`
  (`applyGearCcPhysicalDamage`), but it hardcodes `stat: "physical"` and the
  frozen-gear multiplier.

**Change** — Extract `dealEnemyScaledDamage(state, stat, base, combatTexts,
options?: { multiplier, riders })` in `lib/battle` that owns emit + clamp (and
optionally `processEncounterTraitHealthThreshold` / `applyGearKillRewards`), and
route the sites through it, preserving each site's bespoke rider via a callback
or option. Do **not** change any behavior — this is a pure consolidation.

**Verification** — Unit: full `tests/lib/battle` suite (each touched effect has
pinned tests). Static: `lint:boundaries`.

---

### 3.2 Duplicated `DirectPlayerStatusAttackEffect` type alias

**Evidence** — Identical definition in two modules:
`src/lib/battle/status-player.ts:160` and `src/lib/battle/enemy-turn-attack.ts:21`.

**Change** — Define once in `status-player.ts` (or `types/`) and import into
`enemy-turn-attack.ts`.

**Verification** — Static (`typecheck`).

---

### 3.3 Six hand-written zero-material literals + hand-unrolled per-key loop in reward-math

**Evidence**

- `{ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 }` written out at
  `inventory.ts:10` (the canonical `emptyInventory()`), `costs.ts:8`,
  `data-builders.ts:16`, `loot.ts:28`, `upgrade-node.tsx:14`,
  `run-domain-types.ts:77`.
- `src/features/alchemy/run-loop/navigation/reward-math.ts:64-70` unrolls the
  same per-key `Math.floor(materials.X * multiplier)` five times; `MATERIAL_IDS`
  already exists at `src/lib/homestead/types.ts:8`.

**Change** — Replace the literals with `emptyInventory()`; iterate `MATERIAL_IDS`
in `applyLabyrinthRewardMaterialModifiers`. `schema-enums.ts:29` already shows
the `MATERIAL_IDS.reduce` idiom for this shape. Note `data-builders.ts:16` and
`upgrade-node.tsx:14` are module-level constants that become per-call fresh
objects — fine for a value type.

**Verification** — Static; `tests/lib/homestead.test.ts`,
`tests/features/alchemy/run-loop/navigation/*`.

---

### 3.4 `withPreservedFlags` enumerates the same 14 flag keys twice

**Evidence** — `src/lib/battle/types/state-helpers.ts:6-21` (`FIRST_TIME_FLAG_USED_VALUES`)
and `:28-43` (the `saved` snapshot) each hand-list the identical 14 keys — the
classic drift hazard when a flag is added.

**Change** — Derive `saved` by iterating `Object.keys(FIRST_TIME_FLAG_USED_VALUES)`
so a new flag cannot be forgotten in one list.

**Verification** — Unit: `tests/lib/battle` (`withPreservedFlags` callers);
static.

---

### 3.5 Dead `_rarity` parameter on gear affix functions

**Evidence** — `src/lib/gear/affixes.ts:16, 46` — `resolveAffixEffects` and
`getGearAffixTooltipEntries` take `_rarity` that no body reads; all three callers
still pass it: `operations.ts:212`, `display.ts:15`,
`gear-tooltip-content.tsx:25`.

**Change** — Drop the second parameter and update the three call sites.

**Verification** — Static; armory/gear unit tests.

---

### 3.6 Duplicated freeze/stun CC-trigger branch in status handlers

**Evidence** — `src/lib/battle/effect-handlers/status-handlers.ts:29-33` and
`:67-71` end with the identical block
(`freeze → tryTriggerEnemyFreeze`, `stun → resolveStunTrigger`).

**Change** — One `resolveEnemyStatusCcTrigger(preHitState, nextState, status,
combatTexts)` used by both handlers.

**Verification** — Unit: `tests/lib/battle` status-handler tests; static.

---

### 3.7 Micro: identical leech-mana rider blocks and a thin `shuffleCards` wrapper

**Evidence**

- `src/lib/battle/damage-rider-leech.ts:35-42` — the talent-chance and
  gear-chance blocks are byte-identical except the source field.
- `src/lib/battle/draw.ts:59-61` — `shuffleCards` is just
  `return shuffle(cards, rng)`; its only external caller is `battle-setup.ts:27`.

**Change** — Loop over `[talentEffects, gearEffects].map(e => e.manaOnLeechChance)`
in the rider; call `shuffle` directly and delete `shuffleCards` (draw.ts also
imports `shuffle` already).

**Verification** — Static; `tests/lib/battle` draw/leech tests.

---

## 4. Tests — optimize and de-duplicate

### 4.1 `combat-mechanics.spec.ts` DoT suite: 3 full battle boots asserting only "health went down"

**Evidence** — `tests/combat-mechanics.spec.ts:44-78` loops three battles
(`startBattleWithDeck`, end-turn, `toBeLessThan(enemyHpBefore)` at `:68-70`).
Exact tick math is pinned at unit level (`tests/lib/battle/status-ticks.test.ts`
pins burn 30→20, poison 30→22, bleed reset). The E2E would pass even if ticks
were 1 damage.

**Change** — Keep two battles — **burn** (chip stays visible after the tick,
`:74-76`) and **bleed** (chip appears then disappears, `:72-76`) — and delete the
health assertions; rely on `status-ticks.test.ts` for amounts. Burn's "chip
persists" and bleed's "chip clears" are distinct presentation facts not unit
pinned, so one battle would over-trim.

**Verification** — E2E: the trimmed spec + `@prepush`.

---

### 4.2 `combat-mechanics.spec.ts` companion suite: 2 loose battle boots duplicating unit pins

**Evidence** — `tests/combat-mechanics.spec.ts:122-138` ("auto-attacks") asserts
`< enemyHpBefore`; `:140-158` ("persists") re-asserts the panel after end turns.
`tests/lib/battle/companion.test.ts:26-35` pins Wolf's exact damage (30→29) and
`:157-165` pins the text shape; persistence is pinned at `:8-24` and
`integration/end-player-turn.test.ts:304-317`.

**Change** — Delete both; keep "summon places companion in panel" (`:110-120`,
a genuine render signal).

**Verification** — E2E: the trimmed spec + `@prepush`.

---

### 4.3 `combat-mechanics.spec.ts` CC suite: HP-unchanged is an indistinguishably loose proxy

**Evidence** — `tests/combat-mechanics.spec.ts:81-105` asserts
`playerHealth === playerHpBefore` after a stun/freeze end-turn. CC thresholds and
skip turns are exact in `status-cc.test.ts:33-49, 83-96`, `enemy-turn.test.ts:72-89`,
`integration/damage.test.ts:348-374`; the E2E cannot distinguish "CC skip" from
"enemy never attacks." The CC **presentation** (badge, no hand flash) is already
covered by `stun-enemy-turn-presentation.spec.ts`.

**Change** — Delete the two CC tests.

**Verification** — E2E: `@prepush` (CC still covered by unit +
`stun-enemy-turn-presentation.spec.ts`).

---

### 4.4 `difficulty-select.spec.ts` modifier tests boot 2 full campaigns for unit-pinned health

**Evidence** — `tests/difficulty-select.spec.ts:89-122` drives character-select →
Play → battle and asserts enemy health `=== 30` / `> 30`. The math is pinned at
`battle-enemy-setup.test.ts:60-65`, `difficulties.test.ts:136-148`,
`run-domain.test.ts:536-554`. The Novice case (`:106`) is also fragile: it
hard-asserts the first _randomly chosen_ enemy has exactly 30 HP.

**Change** — Delete both tests (the flow itself — select difficulty, start a
battle — is covered by `:38-59`). Trade-off accepted: this removes the only E2E
that selects Legend and boots, but Legend's screen flow is identical to Novice's
and its numbers are unit-pinned.

**Verification** — E2E: `difficulty-select.spec.ts` + `@prepush`.

---

### 4.5 `gear-combat.spec.ts` Armory-lock gate boots a full battle for a UI gate

**Evidence** — `tests/gear-combat.spec.ts:23-43` runs `startBattleWithDeck` only
to open the battle menu → Armory and assert the editing lock. Siblings already
reach an in-battle screen deterministically via save injection:
`run-outcomes.spec.ts:98-137` and `death-door-flow.spec.ts:24-37`
(`injectSaveState({ currentScreen: "battle", activeCombat: { battleState:
makeGoblinBattleState(), ... } })`).

**Change** — Convert to `injectSaveState(page, { currentScreen: "battle",
activeCombat: { battleState: makeGoblinBattleState(), activeLabyrinthModifiers:
[], activeLabyrinthRewardModifiers: [] } })` then `page.goto("/")`, mirroring
`run-outcomes.spec.ts:111-121`. **Keep the meta-gear injection:** call
`injectHomestead`/`gotoWithUnlockedMeta` _first_ (its init script must run before
the battle-save init script, and `injectSaveState` preserves existing
localStorage), then `injectSaveState`, then a final `page.goto("/")` so the
battle-save init script applies on a fresh navigation. The `gearItemLocator` /
`toHaveCount(1)` asserts need the equipped body gear to be present.

**Verification** — E2E: `gear-combat.spec.ts` + `@prepush`.

---

### 4.6 `run-outcomes.spec.ts` end-run defeat test boots a battle that the injected sibling already covers

**Evidence** — `tests/run-outcomes.spec.ts:78-96` boots `startBattleWithDeck` +
6 cards to click the in-battle "End Run", then asserts the identical tail
(Defeat → Continue → menu, `activeRun === null`) that the injected lethal-defeat
sibling `:98-137` owns at `:127-136`.

**Change** — Convert `:78-96` to an injected battle save (the End-Run button is
reachable from an injected battle screen), or delete it and let `:98-137` own the
defeat→menu path. Recommend conversion so the End-Run button gate keeps an E2E
without the boot cost.

**Verification** — E2E: `run-outcomes.spec.ts` + `@prepush`.

---

### 4.7 `menu-navigation.spec.ts` Resume test boots a full campaign to reach a hydrated button

**Evidence** — `tests/menu-navigation.spec.ts:32-42` uses `startCampaignBattle`
(character-select + full battle boot) just to assert the Resume button appears
after returning to game-mode select. The Labyrinth sibling (`:44-56`) reaches the
same button via `injectLabyrinthRun`, and `save-persistence.spec.ts:31-67` proves
an injected `activeRun` alone surfaces Resume.

**Change** — Replace `startCampaignBattle` with
`injectSaveState(page, { currentScreen: "battle" })` (Resume visibility is a
hydration concern, not a boot concern).

**Verification** — E2E: `menu-navigation.spec.ts` + `@prepush`.

---

### 4.8 Redundant Death's Door "does not re-trigger" block in the integration suite

**Evidence** — `tests/lib/battle/integration/end-player-turn.test.ts:131-143`
("does not retrigger Death's Door after it was consumed") ≡
`tests/lib/battle/enemy-turn.test.ts:326-338` ("Death's Door does not re-trigger
when already consumed"): same inputs (health 3, `deathsDoorUsed: true`, one lethal
hit) and same outcome (health 0, `deathsDoorActive: false`). Same class already
removed for card-play guards in round 1.

**Change** — Delete the integration copy; optionally add the
`isPlayerDefeated(result.state)` assert to the base block for the extra signal.

**Verification** — Unit: both suites; full `tests/lib/battle`.

---

### 4.9 Redundant overkill-clamp pin in the integration suite

**Evidence** — `tests/lib/battle/integration/damage.test.ts:280-288` ("overkill
damage is clamped to 0 health", via `applyCardEffects`) duplicates
`tests/lib/battle/damage-base.test.ts:110-121` ("does not decrease health below
0", via `dealDamageToEnemy`). Lower-confidence dedupe than 4.8 — the integration
version exercises the full handler chain — but the assertion is the same and the
base file is canonical.

**Change** — Delete the integration copy (the handler-chain path is covered by
countless other integration damage tests). The stale describe header
("dealDamageToEnemy — overkill clamping" while it calls `applyCardEffects`) goes
with it.

**Verification** — Unit: both suites.

---

### 4.10 Local `makeCard` factories in feature suites re-implement the shared fixture

**Evidence** — Hand-rolled damage-card factories at
`tests/features/alchemy/run-loop/corruption.test.ts:17-26`,
`tests/features/alchemy/run-loop/shop-transactions.test.ts:27-28`,
`tests/features/alchemy/run-loop/shop/create-shop-actions.test.ts:61-63`, while
`tests/fixtures/cards.ts` provides `makeTestCard`/`makeTestCardWithId` and
`tests/fixtures/battle.ts` provides `makeEffect` (round 1 removed the battle-suite
copies but left these).

**Change** — Replace with `makeTestCard({ id, effects: [makeEffect("physical", n)] })`
(pass `effects` explicitly — `makeTestCard` defaults to `effects: []`).

**Verification** — Unit: the three touched suites.

---

### 4.11 `save-injection.ts` uses a raw 50ms sleep to dodge an autosave race

**Evidence** — `tests/e2e/save-injection.ts:74-77` double-writes the desktop save
with `await new Promise((resolve) => setTimeout(resolve, 50))` between writes;
the comment concedes a Victory/rewards autosave can overwrite the first inject.

**Change** — Replace the sleep with a poll that does not need to read save
contents: the desktop bridge exposes no `readSave` (only `listSaveCandidates` →
paths, `writeSave`, `clearSave`, `steamCloudRead`), so a content-poll would
require a new IPC seam (a scope expansion, contradicting the plan's boundary).
Use the existing surface: after the first write, poll until
`window.alchemyDesktop.listSaveCandidates()` returns a candidate (and any
pending `steamCloudRead` candidate settles), then write again — no fixed
wall-clock dependency, no new API. If a content-verified write is ever needed,
add a `readSave` bridge method as a deliberate follow-up.

**Verification** — E2E: `test:ship:desktop` / electron smoke + save-injection
consumers (`save-persistence.spec.ts`, `run-outcomes.spec.ts`).

---

### 4.12 Wildwood reward-skip test plays a full boss gauntlet for a UI gate

**Evidence** — `tests/wildwood.spec.ts:155-193` injects a mid-`draft` save, then
`wildwoodWinCombat` (up to 6 play/end-turn cycles, `test.setTimeout(45000)`) to
assert the "Skip" reward button. The local `wildwoodDraftDefaults`/`wildwoodBossState`
helpers (`:21-53`) already parameterize `phase`, `rewardType`, `rewardChoiceIds`,
so a mid-`reward` save is constructible without combat.

**Change** — Inject `wildwoodDraftDefaults({ phase: "reward", rewardType: ...,
rewardChoiceIds: [...] })` and assert the Skip gate directly. Implemented and
verified: the reward screen hydrates reward state from a `phase: "reward"`
`wildwoodDraft` (via `restoreWildwoodRewardState`), and with a 5-card deck the
post-skip removal offering is skipped, so Skip starts the next boss battle.

**Verification** — E2E: `wildwood.spec.ts` + `@prepush`.

---

## Scope / risks

- **Not included:** multi-wish stale-state generation (`wish.ts:146-159` builds
  every wish's options from the pre-trigger `state`) — a real subtlety, but the
  fix changes RNG draw order and would invalidate pinned seed sequences; defer
  unless wish-count-2 behavior becomes a product goal. `weightedPick` boundary
  roll (`destination-flow.ts:105-115`) is benign in practice. `displayOverrides`
  reset-to-`{}` churn is masked by the fact that `battleState` identity changes
  every commit anyway. These are called out so future passes don't re-litigate.
- **1.1 resolved:** wildwood does not pay run materials (two independent guards
  show intent); implemented option B — the crystal wish outcome grants gold in
  wildwood instead of dropping. Requires a `contentSystemType` field on
  `BattleState` (set at battle-init from the run, round-trips through the loose
  persisted-battle schema).
- **2.3 resolved:** the mid-battle skip was rejected because
  `save-persistence.spec.ts` requires mid-battle persistence; landed the
  battle-aware debounce raise instead (still behavior-adjacent, covered by the
  save-persistence suite).
- **3.1 is a consolidation, not a behavior change:** any behavioral drift in the
  five sites is a regression; keep the per-site rider callbacks and rely on the
  pinned unit tests.
- **Test trims 4.1-4.4 delete E2E coverage** in favor of unit pins that already
  exist and are exact; 4.3's presentation concern remains covered by the
  real-animation spec.

## Execution order

1. Bugs (1.1 decision, then 1.2-1.5) — smallest, highest-certainty wins; unit
   verify each.
2. Simplify (3.1-3.7) — pure refactors; run `lint:boundaries` after 3.1 and the
   full `tests/lib/battle` suite.
3. Perf (2.1, 2.2, 2.4, 2.5 first; 2.3 last and only after the save-persistence
   check) — self-contained, unit/static gated.
4. Tests (4.1-4.12) — last, since they trim E2E runtime that perf changes also
   affect; re-run full `@prepush` once after all E2E-adjacent edits.

All steps are complete; see the implementation-status note in the Overview.
