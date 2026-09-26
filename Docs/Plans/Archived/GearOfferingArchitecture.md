---
status: complete
updated: 2026-09-25
---

# Gear offer generation architecture

An internal offering pool now owns base-item and Unique reservations and
recomputes rarity availability before each choice. This replaces separately
passed mutable collections while preserving public generation functions,
Unique exclusions, base diversity, narrow-shelf refill, and RNG order.

The changed-path handoff gate passed. A temporary comparison across 100 seeds
matched offered definitions, affix rolls, and world RNG draw counts for ordinary
rewards, narrow shelves, and mixed-rarity rewards. The comparison files were
removed after validation; focused generation coverage remains in the implementation
commit.

Implementation: `fc67516a`. Current owner: [Loot tuning](../../ARMORY.md#loot-tuning).
