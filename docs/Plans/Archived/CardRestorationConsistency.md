---
status: complete
updated: 2026-09-07
implementation: fee9d106
---

# Consistent saved-card restoration

## Decision and rationale

Implemented in `fee9d106`. Saved effects and descriptions are restored as one
content unit. Previously, validation could discard an invalid effect while
retaining its prose, and hydration could choose library text independently of
saved effects. Both paths made cards advertise behavior they did not execute.
Comparing effect counts was also insufficient: valid modified cards may contain
more effects than their current catalog definitions.

## Compatibility consequences

Complete validated modifications remain paired with their saved descriptions.
Incomplete or damaged content restores both lists from the library and clears
stale Corruption markers. Valid identity, cost, and explicit Consume overrides
survive. An empty effect list carries the recovery signal through normalization
and JSON round trips without a new field or version bump. This does not prove
that arbitrary saved prose matches arbitrary effects; it prevents mismatches
introduced by the game's own restoration pipeline.

The current [save contract](../../../src/features/alchemy/shared/storage/MIGRATIONS.md#implementation-rules)
owns the complete recovery policy.

## Verification recorded at implementation

Regressions covered partial effects, missing descriptions, valid extended cards,
saved battle piles, choices, and repeated restoration through production save
loading. `check-20260907t014120z-28412-1c01f3` passed documentation, related and
changed unit tests, the save/persistence suite, CI static checks, the web build,
and preview smoke. No gameplay balance, reward-pool, or RNG changes were required.
