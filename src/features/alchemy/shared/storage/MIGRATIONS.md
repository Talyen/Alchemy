# Save Migration Guide

This file documents how to change persisted save data without breaking player progress. **CI is the source of truth** — `tests/architecture/save-migration-guard.test.ts` and `tests/architecture/save-migration-contract.test.ts` enforce the contract on every `npm run test:ship:unit`.

## Supported baseline (pre-launch)

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the **minimum supported** save shape (currently **8**). There are no players yet, so older local schemas are intentionally unsupported: schema step functions exist only for versions `>= LAUNCH_SAVE_SCHEMA_VERSION`. Nested soft remaps in `migrate-active-run.ts`, `migrate-battle-state.ts`, `migrate-wildwood-draft.ts`, `migrate-content-v2.ts`, and `migrate-gear.ts` may still clean some legacy field names when a payload happens to load, but that is not a compatibility guarantee.

After public launch, treat `LAUNCH_SAVE_SCHEMA_VERSION` as frozen and never remove steps that players can still hold.

## When to increment

Increment `CURRENT_SAVE_SCHEMA_VERSION` when a change requires old saved payloads to be transformed before normal field cleanup can safely load them.

Examples:

- Renaming or moving saved fields.
- Changing the shape of `activeRun`, homestead records, talents, or collection data.
- Replacing array-shaped progress with record-shaped progress.
- Changing meanings or units of saved numeric values.

Do **not** increment for purely additive fields that can safely use defaults in Zod / `defaults.ts`.

## Single-responsibility rule

| Change                                                      | Where                                                                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renames, enum value changes, nested `activeRun` shape fixes | `src/lib/validation/migration/` helpers (`migrate-active-run.ts`, `migrate-battle-state.ts`, `migrate-wildwood-draft.ts`, `migrate-gear.ts`) and the new `migrateVNToVNPlus1` step in `steps*.ts` |
| Additive fields with defaults                               | Zod `.default()` / `.catch()` and `defaults.ts` — no schema bump                                                                                                                                  |
| Deck / content-system soft fixes on already-valid shape     | `normalize-active-run-data.ts`                                                                                                                                                                    |

**Do not** put rename logic in `save-schemas/active-run.ts` transforms. Zod must only validate the current shape after preprocess migration.

## Required pattern (automated)

For a schema bump from `N` to `N + 1`:

1. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
2. Add `migrateVNToVNPlus1` in `src/lib/validation/migration/steps.ts` or a topical `steps-*.ts` file (delegate nested work to `migration/` helpers).
3. Chain it from `migrateSaveDataToCurrent` in `src/lib/validation/migration/index.ts`.
4. Update Zod schemas in `src/lib/validation/save-schemas/` and `defaults.ts`.
5. Add a fixture to `LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION` in `tests/fixtures/legacy-saves.ts` (CI fails if any source version `LAUNCH … N-1` is missing).
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
- Mid-combat snapshots preserve trinket effects, gear effects, and combat flags.
- Every fixture is **idempotent** after `normalizeSaveData`.

## Future schema saves

Saves with a schema newer than the current build are intentionally not migrated or overwritten. The load path returns defaults for the session and disables autosave writes so an older build cannot destroy newer progress.

## Public save contract

Until launch, `LAUNCH_SAVE_SCHEMA_VERSION` may move forward when the team deliberately drops unsupported local schemas. **After launch it is frozen.** Every bump to `CURRENT_SAVE_SCHEMA_VERSION >= LAUNCH_SAVE_SCHEMA_VERSION` is a save-compat commitment for supported versions: a player who upgrades from any prior _supported_ build must be able to load and play their existing save.

### Policy: local is authoritative

Steam Cloud is a one-way mirror. Writes go local-first (atomic, with backup-ring rotation) and then mirror to Steam Cloud. On load, candidates are walked in preference order (local → bak.1 → bak.2 → bak.3 → cloud) and the first that Zod-validates is used. Future-versioned candidates are silently skipped. Only when every candidate is from a future version does the load fall back to defaults with writes disabled; even then, the player sees no error UI.

### Implementation rules

- Schema migration steps cover `LAUNCH_SAVE_SCHEMA_VERSION → CURRENT_SAVE_SCHEMA_VERSION` only. Do not remove a supported step without raising `LAUNCH_SAVE_SCHEMA_VERSION` in the same change.
- Card IDs that disappear from the live catalog must be added to `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts`. The guard test in `save-migration-guard.test.ts` fails CI if a fixture references a card ID that is neither in the catalog nor in the tombstone set.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. The run always has a valid, drawable set of cards. No player-facing diagnostics.
- The `SaveLoadStatus` shape has four variants: `ok`, `unsupported-newer-schema`, `unsupported-newer-content`, and `corrupt`. No diagnostic fields surface to the player.

## Progression gate fields

When adding a new saved field that gates features (unlocks, meta screens, game modes):

1. Decide the default for new players — usually empty (`[]`, `{}`, or `false`).
2. List inferrable existing fields for backfill in the migration step only when a real signal exists.
3. Add a fixture at version `N−1` in `tests/fixtures/legacy-saves.ts`.
4. Assert **gameplay outcome** in `save-migration-guard.test.ts` — not only JSON field presence.

## Content version 2 (ID remaps)

`contentVersion` 2 remaps boon-era content IDs in `unlockedTalents`:

| Legacy ID           | Current ID             |
| ------------------- | ---------------------- |
| `wish-boon`         | `wish-trinket`         |
| `leech-boon-siphon` | `leech-trinket-siphon` |
| `boon-hoarder`      | `trinket-hoarder`      |

Applied in `migrateContentV2` whenever `contentVersion < CURRENT_CONTENT_VERSION` after the schema migration chain completes.

## Gear board layout (`gearBoardPositions`)

Armory inventory tile positions persist per character (`gearBoardPositionsByCharacter`). Schema steps v8→v9 / v9→v10 split flat gear inventory + board positions into per-character maps. On first load after those steps, any leftover `localStorage["alchemy-armory-positions"]` entries may still be merged via `readLegacyArmoryBoardPositionsFromStorage`.

## Gear instances (legacy remaps)

Canonical gear instances use `affixes: Array<{ id, value }>`. `migrateLegacyGearInstance` (used from gear Zod normalization) remaps legacy definition IDs, `affixIds`, and `modifiers` into that shape before domain normalization.

## Active-run RNG streams (`activeRun.rng`)

Active runs persist a seed and counters for named run-outcome streams. This is an additive nested field, so it does not require a top-level schema-version bump: `ActiveRunDataSchema` creates a fresh seed with zero counters when loading a legacy active run. After that first load, the normal autosave writes the explicit RNG state and all subsequent resumes continue the same sequence.

## Battle transition continuation

`activeCombat.pendingBattleTransition` is an additive field with a `null` default. New saves use it to carry a computed enemy-turn result across presentation delays. Older saves with `battleState.turnPhase === "enemy"` and no transition metadata are marked as `legacy-enemy-turn` by the resume codec and normalized to a playable player phase on boot without replaying unknown damage or replaying an enemy action from the RNG stream.
