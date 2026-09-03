# Save Migration Guide

Checklist for a schema change: [WORKFLOWS.md § Change persisted save data](../../../../../docs/WORKFLOWS.md#change-persisted-save-data). This file is the save-compat contract.

This file documents how to change persisted save data without breaking player progress. **CI is the source of truth** — `tests/architecture/save-migration-guard.test.ts` and `tests/architecture/save-migration-contract.test.ts` enforce the contract on every `npm run test:ship:unit`.

Completed schema-specific transformations are recorded in
[MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md); keep this file focused on the
current compatibility contract.

## Supported baseline

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the
**minimum supported** save shape. Read the current value from that source; do
not copy the number into documentation. `migrateSaveDataToCurrent` stamps
`CURRENT_SAVE_SCHEMA_VERSION`, while Zod defaults and `.catch()` repair the
envelope.

After public launch, treat `LAUNCH_SAVE_SCHEMA_VERSION` as frozen and never remove steps that players can still hold.

## When to increment

Increment `CURRENT_SAVE_SCHEMA_VERSION` when a change requires old saved payloads to be transformed before normal field cleanup can safely load them.

Examples:

- Renaming or moving saved fields.
- Changing the shape of `activeRun`, homestead records, talents, or collection data.
- Replacing array-shaped progress with record-shaped progress.
- Changing meanings or units of saved numeric values.

Do **not** increment for purely additive fields that can safely use defaults in Zod / `defaults.ts` (for example optional shop refresh counters). Replacing the resume claim-surface triad with `activeRun.interruptedFlow` required a floor bump (see below).

## Single-responsibility rule

| Change                                                  | Where                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Schema version stamp at load                            | `migrateSaveDataToCurrent` in `src/lib/validation/migration/index.ts`                                                            |
| Additive fields with defaults                           | Zod `.default()` / `.catch()` and `defaults.ts` — no schema bump                                                                 |
| Deck / content-system soft fixes on already-valid shape | `normalize-active-run-data.ts` (does **not** downgrade labyrinth/wildwood; missing map/draft fails refine and drops `activeRun`) |

**Do not** put rename logic in `save-schemas/active-run.ts` transforms. Zod must only validate the current shape after preprocess migration.

## Required pattern (automated)

When the supported floor and current version are equal, loading is stamp-only;
add step modules when a real post-floor transform is required.

For a schema bump from `N` to `N + 1`:

1. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
2. Add `migrateVNToVNPlus1` to `src/lib/validation/migration/content-steps.ts` or a new topical `steps-*.ts` file (delegate nested work to `migration/` helpers when needed).
3. Chain it from `migrateSaveDataToCurrent` in `src/lib/validation/migration/index.ts`.
4. Update Zod schemas in `src/lib/validation/save-schemas/` and `defaults.ts`.
5. Add a fixture to `CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION` in `tests/fixtures/legacy-saves.ts` (CI fails if any source version `LAUNCH … N-1` is missing).
6. If the change touches `activeRun` nested state, add or extend a scenario in `MIGRATION_SCENARIO_FIXTURES` and assert gameplay outcomes in `save-migration-guard.test.ts`.
7. Run `npm run check:ship` — tests use `normalizeSaveData` from `tests/helpers/parse-save-for-tests.ts` (`SaveDataSchema.parse`). Production load uses `safeParseWithErrors(SaveDataSchema, …)` in `io.ts`.

## `saveSchemaVersion` vs `contentVersion`

- **`saveSchemaVersion`** — persisted **structure** (field renames, required nested shapes). Bump with a migration step.
- **`contentVersion`** — reserved for **ID or meaning remaps** in game content
  (card/trinket id splits). Only bump when a migration handler exists for the
  remap; the migration steps and tests are the source of truth for current
  remaps.

## Test expectations

Migration tests must verify gameplay progress, not just field presence:

- Collection discoveries remain unlocked.
- Talent XP and unlocked talents remain usable.
- Homestead materials and upgrade tiers remain intact.
- Active campaign, labyrinth, and wildwood runs resume when structurally valid (**`activeRun` must not be silently dropped**).
- Mid-combat snapshots preserve trinket effects, gear effects, and combat flags.
- Version-specific fixtures continue to assert the outcomes recorded in [MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md).
- Every fixture is **idempotent** after `normalizeSaveData` (`tests/helpers/parse-save-for-tests.ts`).

## Future schema saves

Saves with a schema newer than the current build are intentionally not migrated or overwritten. A recognizable future-versioned candidate protects the session only when it is fresher (by `lastSavedAt`) than every playable candidate — a stale newer-versioned mirror is skipped in favor of the freshest playable backup, which autosave can safely continue. The load path returns defaults for the session and disables autosave writes so an older build cannot destroy newer progress. The player-facing Save Protected screen offers update guidance plus an explicit “Delete local save and continue” escape hatch. Wipe policy splits on session state: during normal play a wipe is cloud-first and fails closed (a Steam Cloud delete failure leaves local data untouched and reports failure, so a mirror copy can never silently resurrect a deleted save); once writes are disabled for the session the persisted data is unusable by this build, so that wipe clears local first (desktop `save.json` + bak.1–3 + tmp), then attempts the Steam Cloud delete best-effort and reports success, with the next save overwriting any residual mirror. Dev builds also accept `?wipeLocalSave=1` to clear before bootstrap.

## Public save contract

The supported floor may move only when the team deliberately drops an
unsupported local shape. Once public saves exist, freeze that floor. Every bump
to `CURRENT_SAVE_SCHEMA_VERSION >= LAUNCH_SAVE_SCHEMA_VERSION` is a
save-compat commitment: a player upgrading from any supported build must be
able to load and play the existing save.

### Policy: local is authoritative

Steam Cloud is a one-way mirror. Writes go local-first (atomic, with backup-ring rotation in `desktop/main.cjs` — `save.json` + `bak.1-3` + `tmp`) and then mirror to Steam Cloud. On load, candidates are collected in preference order (local → bak.1 → bak.2 → bak.3 → cloud) by `src/lib/platform-save-backend.ts#createPlatformSaveBackend` (`uniqueCandidates` deduplicates identical Cloud mirrors), and the freshest playable candidate that Zod-validates (by `lastSavedAt`) is used. Corrupt candidates fall through to the next recovery source. A recognizable future-versioned candidate that is fresher (by `lastSavedAt`) than every playable candidate opens the Save Protected screen with writes disabled; a stale future-versioned mirror is skipped. Evaluation is pure in `src/features/alchemy/shared/storage/save-candidates.ts#evaluateSaveCandidates` for testability.

Browser lifecycle exits (`visibilitychange`, `pagehide`, and `beforeunload`) synchronously flush the latest dirty snapshot to `localStorage` via `writeSync`. Desktop IPC remains on the serialized coalescing queue (`SaveWriteQueue`: rapid enqueues collapse into one runner; the exit path stores the final snapshot and triggers a best-effort async write), so the earlier visibility/pagehide signals give it time to finish before the window closes. A terminal flush (browser `writeSync` or desktop coalesced `queueExitSnapshot`) supersedes any queued snapshot that has not started writing.

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

## Content changes without a save bump

- Balance-only changes to live definitions do not change the save schema.
- Additive fields that load safely through schema or manifest defaults do not require a migration step; keep their defaults while supported saves may omit them.
- Removed catalog IDs are stripped against the live catalog at load; record deliberate removals in the tombstone set above. A meaning or ID remap requires a `contentVersion` handler.
- Battle-only fields that are rebuilt rather than persisted do not affect the save contract.

> Four layers, in load order: **migrate** (versioned shape and content-ID steps) → **normalize** (`normalizeActiveRunData` strips retired cards against the live catalog and soft-fixes valid shapes, e.g. re-offering emptied choice lists) → **hydrate** (`hydrateCard`, shop and Gear catalog filters) → **restore** (ownership filtering in `restoreRunSession`). Never put rename logic in Zod transforms.

## Additive-field appendix

Each row is one additive field that loads through defaults — no bump.
Behavior lives with the owning module; version-specific transforms live in
[MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md).

| Field                                                                             | Default                                                                                                                         | Owner                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `activeRun.rng`                                                                   | fixed fallback seed, zero counters                                                                                              | `save-schemas/active-run.ts`                                                         |
| `activeRun` shop fields                                                           | empty unless `currentScreen` is that shop                                                                                       | `encodePersistedShops`; repair across normalize → shop hydrate → `restoreRunSession` |
| `activeRun.starterDraftChoices`                                                   | `null` on wildwood; the gauntlet re-drafts on entry                                                                             | `encodeActiveRunFromSession`                                                         |
| `activeRun.mysteryVisit`                                                          | kept only while `currentScreen` is mystery                                                                                      | `normalizeActiveRunData`                                                             |
| Draft/mystery choice repair                                                       | re-offered from the live pool on empty                                                                                          | `normalizeActiveRunData`                                                             |
| `activeCombat.pendingBattleTransition`                                            | `null`; legacy enemy phases recover to a playable turn                                                                          | battle resume codec                                                                  |
| `activeRun.activeLabyrinthModifiers` / `activeRun.activeLabyrinthRewardModifiers` | `[]`; expedition-level twists persist outside combat, backfilled from `activeCombat` on old saves, top-level wins on divergence | `save-schemas/active-run.ts` + `normalizeActiveRunData`                              |
| `parkedRuns` / `runRecency`                                                       | empty; corrupt slots drop without wiping the save                                                                               | run codecs                                                                           |
| `gold` / `runMetaMaxHealth`                                                       | profile purse wins unless in-combat gold exists; `0` means `runMaxHealth`                                                       | `save-schemas/save-data.ts`                                                          |
