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

1. Update `CURRENT_SAVE_SCHEMA_VERSION` in `metadata.ts`.
2. Add `migrateVNToVNPlus1(raw)` in `migrations.ts`.
3. Chain it from `migrateSaveDataToCurrent`.
4. Keep `normalizeSaveData` as the final cleanup step after all migrations.
5. Add or update fixture-style tests in `tests/fixtures/legacy-saves.ts` and `tests/features/storage.test.ts`.

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
