---
status: complete
updated: 2026-09-24
---

# Gear offer generation architecture

## Objective

Make Gear reward and equipment-shop offers easier to change without breaking
Unique exclusions, base-item diversity, or narrow-shelf refill. The current
generator passes four mutable collections and nine positional arguments across
selection helpers, so eligibility and reservation rules are split between them.

## Plan

- [x] Encapsulate one offer's base and Unique reservations in an internal pool;
      compute rarity availability from that pool before each roll.
- [x] Route Unique and ordinary choices through pool operations while preserving
      public generation functions, fallback policy, and RNG draw order.
- [x] Cover narrow pools, refill, Unique pairing, and exhausted Unique fallback
      in focused Gear generation tests.
- [x] Update the Armory's canonical offer-generation guidance, review the diff,
      run the changed-path handoff gate, and archive this plan.

## Notes

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).

The changed-path handoff gate passed. A temporary baseline comparison across
100 seeds also matched offered definitions, affix rolls, and world RNG draw
counts for ordinary rewards, narrow shelves, and mixed-rarity rewards; the
comparison files were removed after validation.
