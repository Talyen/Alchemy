---
status: complete
updated: 2026-09-25
---

# Battle reward ownership

Battle rewards now have a gameplay owner in `player-rewards.ts`, separate from
combat-text aggregation and enemy healing. The shared Health primitive keeps
ordinary and defeat healing distinct, preserving reward order and Blood Countess's
reaction to actual restoration. Health, cleanse, Block, Armor, Gold, and defeat
reactions remain together because splitting their coupled rules would introduce
circular dependencies.

The implementation commit includes focused battle reward tests; this record
retains no separate handoff-gate result.

Implementation: `fc67516a`. Current owner: [Battle path](../../ARCHITECTURE.md#battle-path).
