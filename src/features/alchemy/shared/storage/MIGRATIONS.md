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

Do **not** increment for purely additive fields that can safely use defaults in Zod / `defaults.ts` (for example optional shop refresh counters). Historical transformations live in [MIGRATION_HISTORY](./MIGRATION_HISTORY.md).

## Single-responsibility rule

| Change                                                  | Where                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Schema version stamp at load                            | `migrateSaveDataToCurrent` in `src/lib/validation/migration/index.ts`                                                            |
| Additive fields with defaults                           | Zod `.default()` / `.catch()` and `defaults.ts` — no schema bump                                                                 |
| Deck / content-system soft fixes on already-valid shape | `normalize-active-run-data.ts` (does **not** downgrade labyrinth/wildwood; missing map/draft fails refine and drops `activeRun`) |

**Do not** put rename logic in `save-schemas/active-run.ts` transforms. Zod must only validate the current shape after preprocess migration. The [unversioned battle-talent shims](./MIGRATION_HISTORY.md#unversioned-battle-talent-shims) are retained legacy exceptions, not a pattern for new renames. The long-standing `crystal → gems`, `recovery → reward`, and `wildwood-recovery → rewards` preprocessors in `save-schemas/` are grandfathered under the same exception because supported saves predate the current contract.

## Required pattern (automated)

When the supported floor and current version are equal, loading is stamp-only;
add step modules when a real post-floor transform is required.

For a schema bump from `N` to `N + 1`:

1. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
2. Add `migrateVNToVNPlus1` in a `steps-*.ts` module under `src/lib/validation/migration/`. Keep content-ID remaps in the separate `content-steps.ts` owner.
3. Register `{ from: N, to: N + 1, migrate: migrateVNToVNPlus1 }` in `SCHEMA_MIGRATIONS` in `src/lib/validation/migration/index.ts` so the chain covers every increment from the supported floor without gaps.
4. Update Zod schemas in `src/lib/validation/save-schemas/` and `defaults.ts`.
5. Add a fixture to `CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION` in `tests/fixtures/legacy-saves.ts` (CI fails if any source version `LAUNCH … N-1` is missing).
6. If the change touches `activeRun` nested state, add or extend a scenario in `MIGRATION_SCENARIO_FIXTURES` and assert gameplay outcomes in `save-migration-guard.test.ts`.
7. Run `npm run check:ship` — tests use `normalizeSaveData` from `tests/helpers/parse-save-for-tests.ts` (`SaveDataSchema.parse`). Production load uses `safeParseWithErrors(SaveDataSchema, …)` in `save-candidates.ts` via `evaluateSaveCandidates`.

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
- Dodge counters (`playerDodgeCount`, `dodgeChanceFromDamage`) default to zero in old battle snapshots and pending result states. New snapshots retain both values. Dodge XP is already present in run progress when an enemy-turn continuation is saved; restoring that continuation must not award it again. These additive defaults do not require a version bump or talent ID remapping.
- Talent replacement IDs and unlocked progress are unchanged. New sequence, Companion bonus, Sanguine Overflow, and Dark Recovery flags default to false/zero in old battle snapshots and pending results; current snapshots preserve them. The new effects are additive manifest fields and need no schema-version bump. Retired effect fields and their readers remain for already-saved combat manifests; recomputing talents from unlocks uses the replacement definitions. Existing queued choices and resolved enemy-turn results are not rerolled or rewarded again.
- The distinct talent/card rework keeps all unlock and card IDs. New manifest fields default to zero/false; `nextHolyCardFree` and `killRewardsPaid` default to false and persist through saved battles and pending results. Retired first-use and direct-stack proc fields retain their readers for captured old manifests. New catalog cards all cost one Mana; valid saved cost, Consume, effects, descriptions, and corruption overrides retain their existing meanings. No version bump is needed.
- Mana from Heaven banks its next-turn reward in `flags.pendingWishMana`, defaulting to zero in old snapshots and retained in current snapshots and pending enemy-turn results. The five talent interaction replacements keep their unlock IDs and add manifest fields with zero defaults; old saved manifests retain immediate Wish Mana, Burn-hit Forge, flat Holy retaliation, and first-card Leech until the battle finishes. No schema bump is needed.
- Version-specific fixtures continue to assert the outcomes recorded in [MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md).
- Enemy ability migration preserves active/parked battles and already-resolved continuations without rerolling or duplicating rewards. New saves retain canonical ability IDs and last-used history; the legacy Thorns marker remains distinct from card-granted stacks. See [schema 16](./MIGRATION_HISTORY.md#schema-16--enemy-card-abilities).
- Every fixture is **idempotent** after `normalizeSaveData` (`tests/helpers/parse-save-for-tests.ts`).

Labyrinth maps add nullable `currentNodeId`, defaulting to the floor entrance for
older saves. Invalid or uncleared references are repaired to null without dropping
the active run. Existing floors, pending encounters, and reward state are retained;
boss completion now waits for explicit descent rather than generating immediately.
No schema bump is required for the additive default. New-floor generation resets
the position, and already-generated saved floors are reused.
New five-row floor templates do not tighten saved-coordinate validation: maps
through row 8 remain accepted, and the fifth visual column is now accepted too.
Existing coordinates are never repacked or regenerated. The persisted shape is
unchanged and no schema bump is needed.

## Future schema saves

Saves with a schema newer than the current build are intentionally not migrated or overwritten. A recognizable future-versioned candidate protects the session only when it is fresher (by `lastSavedAt`) than every playable candidate — a stale newer-versioned mirror is skipped in favor of the freshest playable backup, which autosave can safely continue. Timestamp ties load the playable backup. The load path returns defaults for the session and disables autosave writes so an older build cannot destroy newer progress. The player-facing Save Protected screen offers update guidance plus an explicit “Delete local save and continue” escape hatch. Wipe policy splits on session state: during normal play a wipe is cloud-first and fails closed (a Steam Cloud delete failure leaves local data untouched and reports failure, so a mirror copy can never silently resurrect a deleted save); once writes are disabled for the session the persisted data is unusable by this build, so that wipe clears local first (desktop `save.json` + bak.1–3 + tmp), then attempts the Steam Cloud delete best-effort and reports success, with the next save overwriting any residual mirror. Dev builds also accept `?wipeLocalSave=1` to clear before bootstrap.

## Public save contract

The supported floor may move only when the team deliberately drops an
unsupported local shape. Once public saves exist, freeze that floor. Every bump
to `CURRENT_SAVE_SCHEMA_VERSION >= LAUNCH_SAVE_SCHEMA_VERSION` is a
save-compat commitment: a player upgrading from any supported build must be
able to load and play the existing save.

### Policy: local is authoritative

Steam Cloud is a one-way mirror. Writes go local-first (atomic, with backup-ring rotation in `desktop/main.cjs` — `save.json` + `bak.1-3` + `tmp`) and then mirror to Steam Cloud. On load, candidates are collected in preference order (local → bak.1 → bak.2 → bak.3 → cloud) by `src/lib/platform-save-backend.ts#createPlatformSaveBackend` (`uniqueCandidates` deduplicates identical Cloud mirrors), and the freshest playable candidate that Zod-validates (by `lastSavedAt`) is used. Corrupt candidates fall through to the next recovery source. A recognizable future-versioned candidate that is fresher (by `lastSavedAt`) than every playable candidate opens the Save Protected screen with writes disabled; a stale future-versioned mirror is skipped. Evaluation is deterministic in `src/features/alchemy/shared/storage/save-candidates.ts#evaluateSaveCandidates` for testability; recovery diagnostics are logged at the I/O seam, and only the winning candidate is hydrated against the live catalog.

Device display preferences (`alchemy-device-display-v1`) stay outside the versioned save: they survive save wipes, are never cloud-mirrored, and never gate loads.

Normal saves and explicit flushes return `saved`, `failed`, or `skipped`. `saved` means local storage accepted that snapshot or a newer coalesced replacement; a cloud-mirror failure remains non-fatal. Serialization and backend failures are logged at the I/O seam and returned to the caller.

Autosave retains unacknowledged changes until a covering write succeeds. In-memory revisions prevent an older completion from clearing newer progress. Failed writes retry through the existing single timer no sooner than 10 seconds after failure, including when animations are disabled or new changes arrive. Timing math lives in `src/app/autosave-scheduler.ts` with unit coverage; the React hook owns only subscriptions and lifecycle listeners. Exit signals may bypass that cooldown. Clear requests and write protection invalidate pending acknowledgements and cancel scheduled autosaves; disabled persistence and hook cleanup also stop retries. A late completion cannot restart cancelled work. No scheduling metadata is persisted.

Browser lifecycle exits (`visibilitychange`, `pagehide`, and `beforeunload`) synchronously flush the latest unacknowledged snapshot to `localStorage` via `writeSync`. A successful synchronous flush returns `saved` immediately when the queue is idle. If an older write may still land, the latest snapshot also replaces pending queue work and completion waits for that final write. Desktop IPC uses the same serialized coalescing queue and returns a promise for the actual write outcome. A failed synchronous exit remains retryable while mounted. Desktop shutdown remains best effort, so earlier visibility/pagehide signals give IPC time to finish before the window closes. Terminal saves supersede queued snapshots that have not started writing.

### Load order

Five stages, in load order: **migrate** (versioned shape and content-ID steps) → **validate** (Zod object schemas) → **normalize** (`normalizeActiveRunData` strips retired cards against the live catalog and soft-fixes valid shapes, e.g. re-offering emptied choice lists) → **hydrate** (`hydrateCard`, shop and Gear catalog filters, `initializeGear` + owned-unique union) → **restore** (ownership filtering in `restoreRunSession`). Never put rename logic in Zod transforms.

### Implementation rules

- Schema migration steps cover `LAUNCH_SAVE_SCHEMA_VERSION → CURRENT_SAVE_SCHEMA_VERSION` only. Do not remove a supported step without raising `LAUNCH_SAVE_SCHEMA_VERSION` in the same change.
- Card IDs that disappear from the live catalog are stripped against the live catalog at load in `normalize-active-run-data.ts`. Record deliberate removals in `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts` so fixtures stay explicit. The guard test in `save-migration-guard.test.ts` checks `discoveredCardIds` for catalog or tombstone membership; deck, shop, battle, mystery, and corruption piles rely on silent live-catalog stripping without a tombstone requirement.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. The run always has a valid, drawable set of cards. No player-facing diagnostics.
- Card validation and hydration treat saved effects and descriptions as one content unit. `BattleCardSchema` returns an empty effect list if any effect fails validation, including nested effects; missing or malformed lists likewise become empty. `hydrateCard` preserves both saved lists only when both are usable, without comparing their lengths against the current catalog. Otherwise it restores both from the library and clears saved `corrupted`, `baseTitle`, and `corruptedValuePositions`. Valid saved cost, UID, and explicit Consume overrides survive; title, art, and catalog metadata refresh from the library. The empty-list recovery signal survives normalization and JSON round trips without extra saved fields.
- The same card validator covers active-run card locations and saved battle deck, hand, discard, exhausted, Wish options, and Wish queue, including pending battle result states. Battle card hydration occurs when `initializeActiveBattle` restores the session; other card locations hydrate through `toActiveRunData`. Complete valid saved modifications survive even when their effect count differs from current content. Incomplete content recovery may reset card modifications, but requires no schema bump because the persisted shape and valid values retain their meanings.
- The `SaveLoadStatus` shape has four variants: `ok`, `unsupported-newer-schema`, `unsupported-newer-content`, and `corrupt`. No diagnostic fields surface to the player.

## Progression gate fields

When adding a new saved field that gates features (unlocks, meta screens, game modes):

1. Decide the default for new players — usually empty (`[]`, `{}`, or `false`).
2. List inferrable existing fields for backfill in the migration step only when a real signal exists.
3. Add a fixture at version `N−1` in `tests/fixtures/legacy-saves.ts`.
4. Assert **gameplay outcome** in `save-migration-guard.test.ts` — not only JSON field presence.

## Content changes without a save bump

- Balance-only changes to live definitions do not change the save schema. Current Gear normalization lives in `src/lib/gear/` (`normalizeGearInstance`, `normalizeAffixRolls`, canonical unique affixes) with schema enforcement in `save-schemas/gear-schemas.ts`; captured-manifest behavior lives in [ARMORY](../../../../../docs/ARMORY.md#battle-integration) and [Unique items](../../../../../docs/UNIQUE_ITEMS.md#affix-contract); past corrections are recorded in [migration history](./MIGRATION_HISTORY.md#compatible-gear-corrections).
- Additive fields that load safely through schema or manifest defaults do not require a migration step; keep their defaults while supported saves may omit them.
- Removed catalog IDs are stripped against the live catalog at load; record deliberate removals in the tombstone set above. A meaning or ID remap requires a `contentVersion` handler.
- Labyrinth support modifiers reuse node `rewardModifiers` and session/active-run `activeLabyrinthRewardModifiers`; no structural migration is required. Superseded encounter IDs remain loadable and executable, but new Labyrinth rolls exclude them. Battle `encounterBenefits` defaults to `[]`, validates reward IDs, and is cleared outside Labyrinth. Per-turn benefit flags and the once-per-battle Second Wind flag default to false and persist in snapshots and pending result states. Modified Potion effects/descriptions use the existing saved-card contract. Mystery offer hydration applies saved room modifiers to the canonical event, while the already chosen outcome is preserved verbatim to prevent repeat rewards.
- Battle-only fields that are rebuilt rather than persisted do not affect the save contract. `battleMetrics` is simulation-only, omitted in normal battles, and stripped by `normalizePersistedBattleState`; it requires no save bump.

Expanded Corruption outcomes use existing saved effects, descriptions, highlight positions, and explicit Consume overrides; no schema bump is required. Keep `consume: false` when normalizing or rebuilding persisted cards so a reusable corrupted card cannot regain its catalog Consume flag. Legacy numerical corruption results remain loadable without rerolling.

## Defaults and resume normalization

Selected additive defaults and screen-scoped normalization rules are listed
below. These are current compatibility behaviors, not a complete field catalog
or a substitute for the [version decision](#when-to-increment). Behavior lives
with the owning module; version-specific transforms live in
[MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md).

| Field                                                                             | Default                                                                                                                         | Owner                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `activeCombat.uniqueGear`                                                         | Empty readiness, allowances, card references, Forge debt, and delayed arrows; validated for snapshots and pending results       | `UniqueGearBattleStateSchema` + `normalizePersistedBattleState`                                                      |
| `activeCombat.flags.emberforgedUsedThisTurn`                                      | `false`; saved `true` prevents another Forge grant on the resumed turn                                                          | `normalizePersistedBattleState` + `combat-flags.ts`                                                                  |
| `restore-mana.allowOverflow`                                                      | omitted behaves as `false`; saved companion effects retain their authored value                                                 | `mana-health-schemas.ts` + mana handler                                                                              |
| `activeRun.rng`                                                                   | fixed fallback seed, zero counters                                                                                              | `save-schemas/active-run.ts`                                                                                         |
| `activeRun` shop fields                                                           | empty unless `currentScreen` is that shop                                                                                       | `encodePersistedShops`; repair across normalize → shop hydrate → `restoreRunSession`                                 |
| `activeRun.starterDraftChoices`                                                   | `null` on wildwood; the gauntlet re-drafts on entry                                                                             | `encodeActiveRunFromSession`                                                                                         |
| `activeRun.mysteryVisit`                                                          | kept only while `currentScreen` is mystery                                                                                      | `normalizeActiveRunData`                                                                                             |
| Draft/mystery choice repair                                                       | re-offered from the live pool on empty                                                                                          | `normalizeActiveRunData`                                                                                             |
| `activeCombat.pendingBattleTransition`                                            | `null`; legacy enemy phases recover to a playable turn                                                                          | battle resume codec                                                                                                  |
| `activeRun.activeLabyrinthModifiers` / `activeRun.activeLabyrinthRewardModifiers` | `[]`; expedition-level twists persist outside combat, backfilled from `activeCombat` on old saves, top-level wins on divergence | `save-schemas/active-run.ts` + `normalizeActiveRunData`                                                              |
| `parkedRuns` / `runRecency`                                                       | empty; corrupt slots drop without wiping the save                                                                               | run codecs                                                                                                           |
| `gold` / `runMetaMaxHealth`                                                       | profile purse wins unless in-combat gold exists; `0` means `runMaxHealth`                                                       | `save-schemas/save-data.ts`                                                                                          |
| `backgroundParticlesIntensity` / `backgroundGlowIntensity`                        | `100` (full); clamped to `0–100`; `0` hides the layer                                                                           | settings store (`settings-store.ts`) + `save-schemas/save-data.ts`                                                   |
| `gearInventories` / `gearLoadouts`                                                | empty inventories and loadouts; loadouts pruned of orphan references                                                            | `gear-store-initial-state.ts` (`createEmptyGearInventories`/`Loadouts`) + `save-schemas/save-data.ts` orphan pruning |
| `ownedTrinketIds` / `equippedTrinkets`                                            | empty ownership; equipment normalized for exclusivity against owned IDs                                                         | `gear-actions.ts` (`initializeGear`) + `save-schemas/save-data.ts` orphan pruning                                    |
| `craftingCurrencies`                                                              | zeroed currency record                                                                                                          | `crafting-ids.ts` (`normalizeCraftingCurrencies`)                                                                    |
