---
status: complete
updated: 2026-09-25
---

# Persistence commit policy

Autosave commit filtering now compares saved inputs directly and typechecks the
classification of every run, battle, and session field. It shares transient and
mode-gated classifications with the resume codec and uses the permanent progress
codec's save keys, excluding derived Homestead effects. This prevents new fields
from silently bypassing autosave while preserving one save signal per relevant
commit and the existing save format.

The implementation commit includes persistence coordinator coverage for claim
locks, battle-start snapshots, derived effects, and mode-gated session fields.
This record retains no separate handoff-gate result.

Implementation: `fc67516a`. Current owner: [Persistence API](../../RUN_STATE.md#persistence-api).
