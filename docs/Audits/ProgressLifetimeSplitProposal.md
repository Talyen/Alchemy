# Proposal: Split permanent progress from active-run progress

**Status:** implemented — `progress.run` / `progress.permanent` inside `useRunDomainStore`  
**Related:** [StateGravityOwnershipAudit](./StateGravityOwnershipAudit.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

## Problem

`run-domain-store` `progress` previously owned two lifetimes in one flat slice:

| Lifetime       | Fields                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Permanent meta | `materialInventory`, buildings/farms/research/companions, `talentXP` / `unlockedTalents`, homestead `effects` |
| Active run     | deck, gold, HP, acts, trinkets, difficulty, content system, run-earned tallies                                |

That merge (see CHANGELOG: homestead store folded into progress) simplified persistence wiring, but it is the gravity well the ownership audit warns about: one mutation surface, one subscribe fan-out, and permanent meta changes re-render run consumers that only needed deck/HP.

Phases 1–4 restored facade containment and import direction. They deliberately **did not** split the store — that is a larger lifetime boundary change.

## Goals

1. Restore a real API lifetime boundary: permanent meta vs active-run progress.
2. Keep a single persistence composition path in `shared/storage` (one save document).
3. Do **not** revive deleted fragmented stores (`useHomesteadStore`, `run-progress-store`, etc.). Prefer slice/API split inside the existing domain hub + facade.
4. Preserve `awardMaterialsDuringRun()` as the only run-loot entry for materials.

## Recommended shape (if approved)

```text
useRunDomainStore
  progress.run        — deck, gold, HP, acts, trinkets, content system, …
  progress.permanent  — homestead + talents (+ derived effects)
  session / navigation / battle  — unchanged
```

Facade:

- Keep `useHomesteadAdapter` / `useTalentAdapter` / `useHomesteadProgressSlice` / `useTalentProgressSlice` reading `progress.permanent`.
- Keep `useRunAdapter` / `readActiveRunStore` reading `progress.run` (plus any run-only tallies).
- `applyHomesteadSaveFields` / autosave continue to compose both into one `SaveData`.

## Non-goals

- New parallel Zustand stores or `*Manager` classes for one flow.
- Moving presentation or React into `src/lib`.
- Changing save schema version solely for a rename (prefer in-memory reshape + same persisted fields).

## Suggested execution (after approval)

1. Introduce `progress.run` / `progress.permanent` types and migrate slice actions without changing save JSON.
2. Update facade readers/adapters; keep old field paths as temporary internal aliases only if needed for a one-PR cutover.
3. Update snapshot/restore/`createInitialProgressFields` / architecture save tests.
4. Delete aliases; confirm madge + facade boundary tests stay green.

**Landed:** nested `progress.run` / `progress.permanent` with flat facade projections; save JSON unchanged; autosave reads permanent progress from the domain store.
