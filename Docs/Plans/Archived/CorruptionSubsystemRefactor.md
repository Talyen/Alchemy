---
status: complete
updated: 2026-09-28
---

# Corruption Subsystem Simplification and Defect Hardening

## Objective

Streamline the `src/lib/corruption/` subsystem by reducing over-engineering, eliminating duplicated logic, fixing position tracking bugs during repeated or chained mutations (`corruptedValuePositions`), and hardening edge-case text transformations without altering player-visible gameplay rules.

## Context & Selected Subsystem

A randomized subsystem selection across the codebase (`src/lib/*`, `src/features/*`, `src/app/*`, `scripts/*`) selected `src/lib/corruption`.

The corruption subsystem owns:

- Core mutation selection and execution (`index.ts`, `mutations.ts`).
- Numeric effect and description synchronizer (`numeric.ts`, `numeric-targets.ts`).
- Highlight coordinate tracker (`corruptedValuePositions`) consumed by card UI rendering.
- Shared target discovery used by in-battle Wish upgrades (`wish.ts`).

## Detailed Improvements

### 1. Defect & Inconsistency Fixes

1. **Deduplication of `corruptedValuePositions` in `applyNumericCorruption` (`numeric.ts`)**:
   - In `applyNumericCorruption`, `shiftedExisting` leaves `{ lineIndex, matchIndex }` untouched when modifying an already corrupted value. Appending `{ lineIndex: target.lineIndex, matchIndex: target.matchIndex }` adds duplicate coordinates.
   - Fix: Filter out existing positions matching `target.lineIndex` and `target.matchIndex` prior to appending the new position (mirroring the correct deduplication already in `conversionMutations`).

2. **Highlight preservation and line-index shifting in `removeConsume` (`mutations.ts`)**:
   - `removeConsume` resets `corruptedValuePositions` to `[]`, discarding any prior mutations on the card (e.g. from twin offerings or chained updates). In addition, removing the `"Consume"` line shifts subsequent description lines down by 1 index.
   - Fix: Locate the `"Consume"` line index, retain all valid positions, discard positions on the `"Consume"` line itself, and decrement `lineIndex` by 1 for any positions on subsequent lines.

3. **Type safety and null-coalescing in `addLine` (`mutations.ts`)**:
   - `match.index` from RegExp `matchAll` can theoretically be undefined in TypeScript definitions. Use `match.index ?? 0` and ensure position coordinates remain clean.

4. **Defensive completeness in `isPlainMagnitude` (`mutations.ts`)**:
   - Explicitly check `!effect.equalToBlockPercent` alongside `!effect.equalToBlock` to guard against scaling block-based cards becoming eligible for plain magnitude scaling.

### 2. Code Simplification & De-duplication

1. **Consolidate `isOppositeAxis` (`index.ts`)**:
   - Replace the 4-part bidirectional boolean conditional with a concise `OPPOSITE_AXIS` dictionary lookup (`strengthen` ↔ `weaken`, `consume` ↔ `reusable`).

2. **Consolidate `corruptCard` Result Construction (`index.ts`)**:
   - Remove redundant ternary branches returning identical `{ originalCard, corruptedCard, transformed, delta }` shapes. Extract final card and delta computation into a clean, unified flow.

3. **Declarative line replacement rules in `replaceNumberAt` (`numeric.ts`)**:
   - Restructure special singular/plural and word-to-digit line replacements (`Draw a card`, `Mana Crystal(s)`, `Cleanse harmful status effect(s)`) into a declarative transform pattern table rather than ad-hoc inline regex checks.

4. **Exact match offsets in `numeric-targets.ts`**:
   - Replace loose `line.indexOf(...)` calls in `wishingWellMatch` and `sharedResourceChoice` with exact match offset calculations derived from regex capture indices.

### 3. Verification & Test Coverage

1. Add unit tests for `applyNumericCorruption` verifying no duplicate `corruptedValuePositions` are generated when corrupting a previously mutated card.
2. Add unit tests for `removeConsume` verifying prior corrupted value highlights on other lines are preserved and correctly shifted down.
3. Add unit tests covering plural/singular conversions in `replaceNumberAt`.
4. Run full corruption test suite (`tests/features/alchemy/run-loop/corruption.test.ts`, `tests/lib/battle/corruption-outcomes.test.ts`, `tests/lib/active-run-session/corruption-persistence.test.ts`, and screen tests).

## Notes

- Keep deterministic RNG draw order intact to avoid altering seeded run trajectories.
- Maintain existing public interfaces (`corruptCard`, `corruptDeckCard`, `updateCardNumericValue`, `applyNumericCorruption`, `getEditableCorruptionTargets`).
