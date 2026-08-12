# Plan: Round 3 — Bug, Performance, Complexity, and Test Improvements

## Overview

A comprehensive pass over the codebase identified a third batch of verified improvements across four key areas: **Bugs**, **Performance**, **Complexity & Code Simplification**, and **Test Optimizations**.

Every item below was verified by inspecting source code contracts and caller sites. None require new npm dependencies, save schema migrations, or breaking changes to existing architecture.

---

## 1. Bugs

### 1.1 Companion Leech Talent Suppressed by Companion Heal-On-Attack Gear Effect

**Evidence**

- `src/lib/battle/companion.ts:89-103` — `processCompanionTurnStart` checks `state.gearEffects.healOnCompanionAttack > 0`. If true and the companion card has a damage effect, it executes `return healedState;` directly at line 101.
- `src/lib/battle/companion.ts:105-125` — The next block checks `state.talentEffects.companionLeechChance > 0`. Because line 101 returned early, this block is **never evaluated** when `healOnCompanionAttack > 0`.

**Impact**
Players with both the companion heal-on-attack gear effect and the companion leech talent lose their companion leech healing entirely whenever the gear effect triggers.

**Proposed Fix**
Update `afterEffects` in line 89 instead of returning early:

```ts
if (state.gearEffects.healOnCompanionAttack > 0) {
  const hasDamageEffect = companionCard.effects.some((e) => e.kind === "damage");
  if (hasDamageEffect) {
    const prevState = afterEffects;
    const healedState = applyPlayerHealing(afterEffects, state.gearEffects.healOnCompanionAttack);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: state.gearEffects.healOnCompanionAttack,
    });
    emitOverhealBlockText(prevState, healedState, combatTexts);
    afterEffects = healedState;
  }
}
```

Then execution flows cleanly into `companionLeechChance`, allowing both healing sources to stack as designed.

**Verification**

- Unit: Add unit test in `tests/lib/battle/companion.test.ts` verifying that when both `healOnCompanionAttack > 0` and `companionLeechChance` trigger, both heals are applied to player state and combat text.

---

### 1.2 Stale Queued Save Data Overwrites Wiped Save in `clearAlchemySaveData`

**Evidence**

- `src/features/alchemy/shared/storage/io.ts:264-289` — `clearAlchemySaveData` sets `clearPending = true` while awaiting `removeStorageItem`.
- If `saveAlchemySaveData(data)` is called while `clearAlchemySaveData` is pending or queued on `saveWriteChain`, `coalescedSave` is assigned `data`.
- When `clearAlchemySaveData` completes, its `finally` block sets `clearPending = false`. The queued `saveAlchemySaveData` runner task then executes next on `saveWriteChain`. Seeing `coalescedSave !== null` and `clearPending === false`, it serializes and writes the pre-clear snapshot back to storage, effectively undoing the wipe.

**Impact**
Wiping save data (e.g., during save reset or restart) while background save flushes are pending can cause deleted save data to be restored instantly.

**Proposed Fix**
Clear `coalescedSave = null` inside the `clearAlchemySaveData` write task on `saveWriteChain` so any queued snapshot submitted prior to or during the clear is discarded.

**Verification**

- Unit: Add unit test in `tests/features/alchemy/shared/storage/storage.test.ts` simulating concurrent `saveAlchemySaveData` and `clearAlchemySaveData` calls, verifying storage remains clear.

---

### 1.3 Inverted Mana Cost Deduction Order in Card Play Resolution

**Evidence**

- `src/lib/battle/card-play.ts:102-105` — `executeCardPlayState` applies card effects at line 102 (`nextState = applyCardEffects(nextState, card, combatTexts)`), and then deducts effective cost at line 105 (`nextState = { ...nextState, mana: Math.max(0, nextState.mana - effectiveCost) }`).
- Line 104 has a comment: `// Deduct mana cost first so that refunds aren't capped by maxMana prematurely.`
- Because deduction happens _after_ `applyCardEffects`, any card with a mana restore/refund effect evaluates against the player's pre-card mana. If mana was already at `maxMana`, the refund is capped and lost before line 105 subtracts card cost.

**Impact**
Mana restoration/refund effects on cards are incorrectly capped against `maxMana` before the card's cost is deducted.

**Proposed Fix**
Deduct `effectiveCost` from `nextState.mana` _before_ invoking `applyCardEffects`, so mana refunds have room under `maxMana`.

**Verification**

- Unit: Add unit test in `tests/lib/battle/integration/card-play.test.ts` for a card with cost 2 played at full mana (3/3) that restores 2 mana, ensuring final mana is 3/3 (3 - 2 + 2) instead of 1/3.

---

### 1.4 Floating Combat Text (FCT) Heal Amount Mismatch on Overheal

**Evidence**

- `src/lib/battle/combat-text.ts:73-86` — `applyHealingWithCombatText` emits floating text with the raw attempted heal `amount`:
  `mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount });`
- `applyPlayerHealing` caps actual health gained based on `playerMaxHealth` and converts overheal to block if the overheal-to-block talent is active.

**Impact**
Floating combat text displays full heal numbers (e.g. +20 HP) even when the player was at 99/100 HP and only received 1 HP of actual healing.

**Proposed Fix**
Calculate `actualHeal = nextState.playerHealth - prevState.playerHealth`. If `actualHeal > 0`, emit `actualHeal` in `mergeCombatText`. (Overheal block is already handled separately by `emitOverhealBlockText`).

**Verification**

- Unit: Add unit test in `tests/lib/battle/combat-text.test.ts` verifying floating text amount when healing at near-max health.

---

## 2. Performance Improvements

### 2.1 Memoize Card Description Context in Hand Fan Components

**Evidence**

- `src/features/alchemy/run-loop/screens/battle-screen/hand.tsx:121-128` — `BattleHand` builds `descriptionContext` on every render. Changing any field triggers re-rendering of `HandCardItem` components and sub-tree children.

**Impact**
Redundant component re-renders during high-frequency hand animations and combat state updates.

**Proposed Fix**
Memoize or extract description context preparation and ensure child `HandCardItem` props are properly memoized/stable.

**Verification**

- Unit: `npm test` passing existing hand layout and card render tests.

---

## 3. Code Simplification & Over-engineered Code

### 3.1 Fix Deadcode (`knip`) Failure by Un-exporting `matIconMap`

**Evidence**

- Running `npm run lint:ci` fails at `knip` step with:
  `Unused exports (1) matIconMap src/features/alchemy/shared/ui/material-icons.tsx:11:14`
- `matIconMap` is only referenced internally within `material-icons.tsx` by `MaterialPill`.

**Impact**
`npm run lint:ci` build gate fails.

**Proposed Fix**
Remove `export` keyword from `matIconMap` in `material-icons.tsx` (making it a module-private `const matIconMap`), allowing `knip` and `npm run lint:ci` to pass cleanly.

---

### 3.2 Remove Redundant Re-exports in `card-play.ts`

**Evidence**

- `src/lib/battle/card-play.ts:23` — `export { cardHasDamageType, computeEffectiveCost } from "./card-cost-rules";`
- Consumers can import directly from `@/lib/battle` barrel or `./card-cost-rules`.

**Impact**
Redundant pass-through exports in card resolution module.

**Proposed Fix**
Remove redundant re-export lines from `card-play.ts`.

---

## 4. Test Optimizations & De-duplication

### 4.1 Consolidate Duplicate Battle State Factories in Battle Engine Tests

**Evidence**

- Multiple test files in `tests/lib/battle/` manually define 30-50 property partial objects to construct mock `BattleState` instances instead of reusing `createTestBattleState` or helper factories in `tests/helpers/`.

**Impact**
Duplicate test setup logic, maintenance overhead when `BattleState` is modified.

**Proposed Fix**
Refactor unit tests in `tests/lib/battle/` to use `createTestBattleState` consistently.

---

## Verification Plan

### Automated Tests

- `npm test` — Run all unit tests to confirm 290+ test files pass cleanly.
- `npm run lint:ci` — Verify `format:check`, `typecheck:all`, `lint`, `lint:boundaries`, `lint:architecture-smoke`, and `deadcode` pass with 0 errors.
- `npm run test:e2e:prepush` — Run prepush E2E specs for combat and navigation.

### Manual Verification

- Verify companion attack with both heal gear and leech talent.
- Verify save clear does not get overwritten by queued saves.
