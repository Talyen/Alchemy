# Save Migration Guide

This file documents how to change persisted save data without breaking player progress. **CI is the source of truth** — `tests/architecture/save-migration-guard.test.ts` and `tests/architecture/save-migration-contract.test.ts` enforce the contract on every `npm run test:ship:unit`.

## Launch baseline

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` marks the first public-release save shape (currently **4**). Steps `migrateV0ToV1` … `migrateV3ToV4` in `src/lib/validation/migration/steps.ts` are frozen pre-launch history. Post-launch bumps add `migrateV4ToV5` (etc.) only.

## When to increment

Increment `CURRENT_SAVE_SCHEMA_VERSION` when a change requires old saved payloads to be transformed before normal field cleanup can safely load them.

Examples:
- Renaming or moving saved fields.
- Changing the shape of `activeRun`, homestead records, talents, or collection data.
- Replacing array-shaped progress with record-shaped progress.
- Changing meanings or units of saved numeric values.

Do **not** increment for purely additive fields that can safely use defaults in Zod / `defaults.ts`.

## Single-responsibility rule

| Change | Where |
|--------|--------|
| Renames, enum value changes, nested `activeRun` shape fixes | `src/lib/validation/migration/` helpers (`migrate-active-run.ts`, `migrate-battle-state.ts`, `migrate-wildwood-draft.ts`, `migrate-save-top-level.ts`) and the new `migrateVNToVNPlus1` step in `steps.ts` |
| Additive fields with defaults | Zod `.default()` / `.catch()` and `defaults.ts` — no schema bump |
| Deck / content-system soft fixes on already-valid shape | `normalize-active-run-data.ts` |

**Do not** put rename logic in `save-schemas/active-run.ts` transforms. Zod must only validate the current shape after preprocess migration.

## Required pattern (automated)

For a schema bump from `N` to `N + 1`:

1. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
2. Add `migrateVNToVNPlus1` in `src/lib/validation/migration/steps.ts` (delegate nested work to `migration/` helpers).
3. Chain it from `migrateSaveDataToCurrent` in `src/lib/validation/migration/index.ts`.
4. Update Zod schemas in `src/lib/validation/save-schemas/` and `defaults.ts`.
5. Add a fixture to `LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION` in `tests/fixtures/legacy-saves.ts` (CI fails if any source version `0 … N-1` is missing).
6. If the change touches `activeRun` nested state, add or extend a scenario in `MIGRATION_SCENARIO_FIXTURES` and assert gameplay outcomes in `save-migration-guard.test.ts`.
7. Run `npm run check:ship` — tests use `normalizeSaveData` → `SaveDataSchema.parse` (production path).

## `saveSchemaVersion` vs `contentVersion`

- **`saveSchemaVersion`** — persisted **structure** (field renames, required nested shapes). Bump with a migration step.
- **`contentVersion`** — reserved for **ID or meaning remaps** in game content (card/boon id splits). Only bump when a migration handler exists for the remap.

## Test expectations

Migration tests must verify gameplay progress, not just field presence:

- Collection discoveries remain unlocked.
- Talent XP and unlocked talents remain usable.
- Homestead materials and upgrade tiers remain intact.
- Active campaign, labyrinth, and wildwood runs resume when structurally valid (**`activeRun` must not be silently dropped**).
- Mid-combat snapshots preserve boon effects, gear effects, and combat flags.
- Every fixture is **idempotent** after `normalizeSaveData`.

## Future schema saves

Saves with a schema newer than the current build are intentionally not migrated or overwritten. The load path returns defaults for the session and disables autosave writes so an older build cannot destroy newer progress.

## Progression gate fields

When adding a new saved field that gates features (unlocks, meta screens, game modes):

1. Decide the default for new players — usually empty (`[]`, `{}`, or `false`).
2. List inferrable existing fields for backfill in the migration step only when a real signal exists.
3. Add a fixture at version `N−1` in `tests/fixtures/legacy-saves.ts`.
4. Assert **gameplay outcome** in `save-migration-guard.test.ts` — not only JSON field presence.

## Schema v4 (launch baseline)

Schema v4 renames persisted Trinket fields to Boon fields and introduces Gear inventory/loadouts. Nested renames (battle snapshots, wildwood `rewardType`, combat flags) live in `src/lib/validation/migration/` helpers invoked from `migrateV3ToV4` and the final `migrateActiveRun` pass.
