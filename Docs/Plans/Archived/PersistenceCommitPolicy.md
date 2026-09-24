---
status: complete
updated: 2026-09-24
---

# Persistence commit policy

## Problem

Autosave decides whether a gameplay commit matters by comparing arbitrary object keys through record casts and skip lists. This duplicates the run resume encoder's rules and leaves new session fields classified only by a comment. A missed classification can skip a needed save; a broad comparison can schedule snapshots for changes that cannot appear in one.

## Plan

1. Express the save-relevant run, battle, and session fields as direct typed comparisons. Reuse the encoder's transient and mode-gated field names, and make TypeScript require every session field to be classified.
2. Preserve one save signal per gameplay commit and the current mode-gating semantics. Compare reward payload without the transient claim lock.
3. Extend the persistence coordinator tests for active and inactive mode fields, reward claim changes, battle presentation-only state, and real persisted changes.
4. Update the persistence contract, run the save-focused and changed-path checks, then archive this plan.

## Result

The detector now uses direct comparisons for saved inputs and typechecks the classification of run, battle, and session fields. It reuses the permanent progress codec's save-key list, excluding derived Homestead effects. Persistence coordinator tests cover the claim lock, battle start snapshot, derived effects, and mode-gated session fields.
