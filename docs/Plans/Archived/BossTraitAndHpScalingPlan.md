---
status: complete
updated: 2026-09-07
archived_in: f07bbb72
---

# Boss traits and HP scaling — historical proposal

## Record status

This plan was archived as complete in `f07bbb72`, which originally appeared as
its implementing commit. Inspection of that commit and the current code does
not substantiate completion: the proposed replacement boss kits and boss-specific
content migration are absent. The retained status records the historical
closure, not a verified shipped feature or authorization to implement it now.

## Proposal and rationale

The proposal paired the four bosses with their Trinket-inspired recurring
abilities and changed Normal/Elite/Boss Health multipliers to 1.0/1.5/2.0.
It would have reused the existing one-enemy damage pipeline and seeded RNG,
keeping mitigation, status buildup, death prevention, and combat feedback
consistent with other encounter damage.

## Compatibility consequences

Changing saved boss trait identities would require deliberate handling of
active, parked, and pending-result combat snapshots while preserving ongoing
Health and unrelated effects. That was a proposed requirement, not a completed
migration. [Migration history](../../../src/features/alchemy/shared/storage/MIGRATION_HISTORY.md#content-versions-2-and-3--card-ids)
records the actual content-version changes; version 3 remaps Roulette to Roll
the Dice and does not perform the proposed boss transformation.

## Evidence and current owners

The 2026-09-07 documentation review compared `f07bbb72` with the current
[enemy catalog](../../../src/lib/game-data/compendium/enemies.ts),
[combat tuning](../../../src/lib/game-constants/combat-rules.ts), and
[content migration owner](../../../src/lib/validation/migration/content-steps.ts).
The original acceptance checklist is not a test result, and this record cannot
claim that the proposed boss behavior passed verification. Current game and
compatibility rules belong in their canonical owners; the full proposal remains
in Git history.
