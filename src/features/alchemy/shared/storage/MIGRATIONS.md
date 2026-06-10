# Save Migration Guide

This file documents how to change persisted save data without breaking player progress.

## When To Increment

Increment `CURRENT_SAVE_SCHEMA_VERSION` when a change requires old saved payloads to be transformed before normal field cleanup can safely load them.

Examples:
- Renaming or moving saved fields.
- Changing the shape of `activeRun`, homestead records, talents, or collection data.
- Replacing array-shaped progress with record-shaped progress.
- Changing meanings or units of saved numeric values.

Do not increment for purely additive fields that can safely use defaults.

## Required Pattern

For a schema bump from `N` to `N + 1`:

1. Update `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
2. Add `migrateVNToVNPlus1(raw)` in `src/lib/validation/migration.ts`.
3. Chain it from `migrateSaveDataToCurrent` in the same file (ordering matters; keep steps idempotent).
4. Update Zod fields in `src/lib/validation/save-schemas.ts` and matching defaults in `src/features/alchemy/storage/defaults.ts`. `SaveDataSchema` already preprocesses with `migrateSaveDataToCurrent` on load.
5. Add or update fixture-style tests in `tests/fixtures/legacy-saves.ts` and `tests/features/storage.test.ts`. Use `normalizeSaveData` from `src/features/alchemy/storage/migrations.ts` in tests to exercise the full production parse path (`SaveDataSchema.parse`).

## Test Expectations

Migration tests should verify gameplay progress, not just field presence:

- Collection discoveries remain unlocked.
- Talent XP and unlocked talents remain usable.
- Homestead materials and upgrade tiers remain intact.
- Active campaign and labyrinth runs resume when structurally valid.
- Corrupted cards preserve intentional mutations while refreshing library-owned data.
- Invalid or corrupt fields fall back without wiping unrelated valid progress.

## Future Schema Saves

Saves with a schema newer than the current build are intentionally not migrated or overwritten. The load path returns defaults for the session and disables autosave writes so an older build cannot destroy newer progress.

## Progression Gate Fields

When adding a new saved field that gates features (unlocks, meta screens, game modes):

1. **Decide the default for new players** — usually empty (`[]`, `{}`, or `false`).
2. **List inferrable existing fields** — e.g. `completedDifficulties` keys for character unlocks. Backfill in `migrateVNToVNPlus1` only when a real signal exists; do not guess from unrelated progress (homestead materials alone is a poor signal).
3. **Default in migration only when no signal exists** — `Array.isArray(parsed.field) ? parsed.field : inferredOrDefault`.
4. **Add a legacy fixture** at version N−1 in `tests/fixtures/legacy-saves.ts` that represents saves players may have on disk when the bump ships.
5. **Assert gameplay outcome** — can the player access the gated feature after migration — not just that the JSON field is present.

Migration steps are permanent: a v2→v3 step still runs when a v2 save loads on a later client. Only add backfill logic when saves at that version may exist in the wild; pre-release bumps with no player data can use simple defaults.

Before the first public save-bearing release, review migrations for the schema version players will actually have on disk at launch, and the migration they will hit on the first post-launch update.
