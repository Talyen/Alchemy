# Save Migration Guide

Checklist for a schema change: [WORKFLOWS.md § Change persisted save data](../../../../../docs/WORKFLOWS.md#change-persisted-save-data). This file is the save-compat contract.

This file documents how to change persisted save data without breaking player progress. `tests/architecture/save-migration-guard.test.ts` and `tests/architecture/save-migration-contract.test.ts` enforce this compatibility contract on every `npm run test:ship:unit`. When documentation, tests, and implementation disagree, investigate intended behavior under [AGENTS.md](../../../../../AGENTS.md#documentation-owners); passing tests alone do not resolve the disagreement.

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
2. Add `migrateVNToVNPlus1` in a `steps-*.ts` module under `src/lib/validation/migration/` via `defineRunStep(migrateRun)` (v11→v12 stays bespoke for top-level gear). Keep content-ID remaps in the separate `content-steps.ts` owner.
3. Append the step to `ORDERED_RUN_MIGRATIONS` in `src/lib/validation/migration/index.ts` so the chain covers every increment from the supported floor without gaps (versions derive from position).
4. Update Zod schemas in `src/lib/validation/save-schemas/` and `defaults.ts`.
5. Add a fixture to `CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION` in `tests/fixtures/legacy-saves.ts` for the previous schema version (`N`). Fixtures must cover every supported source version through the previous schema version.
6. If the change touches `activeRun` nested state, add or extend a scenario in `MIGRATION_SCENARIO_FIXTURES` and assert gameplay outcomes in `save-migration-guard.test.ts`.
7. Run the task-scoped `npm run check -- <task-owned paths>` under [CONTRIBUTING](../../../../../CONTRIBUTING.md#what-to-run-when-you-change). Save implementation changes select the complete save/persistence unit suite, including both migration architecture guards; release gates remain part of [release work](../../../../../docs/RELEASE.md).

Tests use `normalizeSaveData` from `tests/helpers/parse-save-for-tests.ts` (`SaveDataSchema.parse`, throwing for test failures). Production load uses `safeParseWithErrors(SaveDataSchema, …)` in `save-candidates.ts` via `evaluateSaveCandidates` (accumulating per-card repair warnings without failing). The split is intentional: tests fail loudly, production repairs quietly and surfaces warnings.

`.catch()` means silent repair: use it for load-tolerant defaults, never for authoring validation. Per-card repair notes travel via nested warnings (see `validation-utils.ts`), not the global collector that was removed. `src/lib/validation/` is load-tolerant (current saves must load); `src/lib/content-validation/` is authoring-strict (content must match effects) — content lint must not import save internals except the stable `ENEMY_STATUS_IDS_LIST`.

Per-step migration tests are intentionally aggregate (`migration.test.ts` + guard scenarios); only complex steps need dedicated `steps-vN-vN+1` files.

## `saveSchemaVersion` vs `contentVersion`

- **`saveSchemaVersion`** — persisted **structure** (field renames, required nested shapes). Bump with a migration step.
- **`contentVersion`** — reserved for **ID or meaning remaps** in game content
  (card/trinket id splits). Only bump when a migration handler exists for the
  remap; the migration steps and tests are the source of truth for current
  remaps.

## Test expectations

Migration tests must verify playable progress, not just field presence:

- Preserve Collection discoveries, talent XP and unlocks, Homestead materials
  and upgrades, inventories, and valid equipment. Quivers lacking a ranged
  main-hand weapon are unequipped during cleanup without losing ownership or
  disturbing other valid slots.
- Structurally valid Campaign, Labyrinth, and Wildwood runs must resume in active
  and parked slots; `activeRun` must not silently disappear. A Labyrinth Wildcard
  starter draft may lack a map until confirmation. Non-null `starterDraftChoices`,
  including an empty array after the last pick, must survive validation and encoding.
- Preserve captured combat manifests, flags, pending choices, and resolved results.
  Additive defaults must cover snapshots and legacy pending results. Retain readers
  for supported legacy fields; recomputing current content must not revoke unlocks
  or reroll or re-award already resolved work. Specific completed changes are in
  [battle-content history](./MIGRATION_HISTORY.md#compatible-battle-content-updates).
- Refresh native enemy Trait metadata from the current catalog while retaining
  encounter modifiers, Health, defenses, ability history, and combat flags. Never
  reapply starting grants or resolve an action during normalization. The
  [enemy ability migration](./MIGRATION_HISTORY.md#schema-16--enemy-card-abilities)
  also preserves the distinct legacy Thorns marker.
- Assert version-specific outcomes from [migration history](./MIGRATION_HISTORY.md)
  and idempotence after `normalizeSaveData` (`tests/helpers/parse-save-for-tests.ts`).

Runtime activity and reward grouping preserve the existing `activeRun`,
`parkedRuns`, screen, shop, reward, and active-combat wire fields. Encode the
logical activity before its screen appears and advance reward bundles atomically
with grants; the claim lock never decides serialization. Infer old menu locations
from surviving run state. Execution RNG callbacks and presentation state are not
saved. New turns and opening hands commit before animation with no continuation;
supported legacy opening-draw, enemy-turn, continue-end-turn, and legacy-enemy-turn
continuations still load and are consumed exactly once. These runtime-only changes
require no schema bump.

Labyrinth recovery preserves geography, completion, pending encounters, and RNG
counters without replaying encounters or revealing unfinished rooms' neighbors.
Current layout and discovery rules live in [Game rules](../../../../../docs/GAME_RULES.md#labyrinth-exploration).
[Schema 17](./MIGRATION_HISTORY.md#schema-17--labyrinth-open-field) is the explicit
prelaunch exception that retires incompatible hex runs while preserving profile
progress and other modes; it is not permission to discard other runs or retain a
legacy renderer. [Schema 18](./MIGRATION_HISTORY.md#schema-18--labyrinth-side-rooms)
adds only side rooms, preserving existing rooms and in-flight progress.

Persistence codecs explicitly select their own fields on both hydration and
encoding. Passing the full save envelope to a narrowly typed codec does not
remove extra runtime keys. Run-profile fields must never contain inventory,
settings, or discovery snapshots that could overwrite their live owners.

## Progression gate fields

When adding a new saved field that gates features (unlocks, meta screens, game modes):

1. Decide the default for new players — usually empty (`[]`, `{}`, or `false`).
2. For a safe additive field, cover old saves with the field missing, the intended default, and explicit values surviving a save/load round trip. No version bump or migration step is needed.
3. If existing progress requires a transformation, follow [the required migration pattern](#required-pattern-automated), including a source-version fixture in `tests/fixtures/legacy-saves.ts` (version `N` for a bump from `N` to `N+1`). Backfill only from real evidence in the saved progress.
4. Assert the resulting feature availability and preserved progress in `save-migration-guard.test.ts` — not only JSON field presence.

## Content changes without a save bump

Content updates preserve valid saved effects, descriptions, and Consume overrides together under the [card hydration contract](#implementation-rules). When complete saved content omits `consume`, it remains reusable; a newly consuming catalog definition must not add Consume to old effects. Incomplete content still recovers the catalog's Consume default unless an explicit saved override exists. Specific compatible updates are recorded in [migration history](./MIGRATION_HISTORY.md#compatible-battle-content-updates).

- Balance-only changes to live definitions do not change the save schema. Current Gear normalization lives in `src/lib/gear/` (`normalizeGearInstance`, `normalizeAffixRolls`, canonical unique affixes) with schema enforcement in `save-schemas/gear-schemas.ts`; captured-manifest behavior lives in [ARMORY](../../../../../docs/ARMORY.md#battle-integration) and [Unique items](../../../../../docs/UNIQUE_ITEMS.md#affix-contract); past corrections are recorded in [migration history](./MIGRATION_HISTORY.md#compatible-gear-corrections).
- Additive fields that load safely through schema or manifest defaults do not require a migration step; keep their defaults while supported saves may omit them.
- Removed catalog IDs are stripped against the live catalog at load; record deliberate removals in the [tombstone set](#implementation-rules). A meaning or ID remap requires a `contentVersion` handler.
- Labyrinth support modifiers reuse node `rewardModifiers` and session/active-run `activeLabyrinthRewardModifiers`; no structural migration is required. Superseded encounter IDs remain loadable and executable, but new Labyrinth rolls exclude them. Battle `encounterBenefits` defaults to `[]`, validates reward IDs, and is cleared outside Labyrinth. Per-turn benefit flags and the once-per-battle Second Wind flag default to false and persist in snapshots and pending result states. Modified Potion effects/descriptions use the existing saved-card contract. Mystery offer hydration applies saved room modifiers to the canonical event, while the already chosen outcome is preserved verbatim to prevent repeat rewards.
- Battle-only fields that are rebuilt rather than persisted do not affect the save contract. `battleMetrics` is simulation-only, omitted in normal battles, and stripped by `normalizePersistedBattleState`; it requires no save bump.

Expanded Corruption outcomes use existing saved effects, descriptions, highlight positions, and explicit Consume overrides; no schema bump is required. Keep `consume: false` when normalizing or rebuilding persisted cards so a reusable corrupted card cannot regain its catalog Consume flag. Legacy numerical corruption results remain loadable without rerolling.

## Defaults and resume normalization

Selected additive defaults and screen-scoped normalization rules are listed
below. These are current compatibility behaviors, not a complete field catalog
or a substitute for the [version decision](#when-to-increment). Behavior lives
with the owning module; version-specific transforms live in
[MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md).

| Field                                                                             | Default                                                                                                                             | Owner                                                                                                                |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `activeCombat.uniqueGear`                                                         | Empty readiness, allowances, card references, Forge debt, and delayed arrows; validated for snapshots and pending results           | `UniqueGearBattleStateSchema` + `normalizePersistedBattleState`                                                      |
| `activeCombat.flags.emberforgedUsedThisTurn`                                      | `false`; saved `true` prevents another Forge grant on the resumed turn                                                              | `normalizePersistedBattleState` + `combat-flags.ts`                                                                  |
| `restore-mana.allowOverflow`                                                      | omitted behaves as `false`; saved companion effects retain their authored value                                                     | `mana-health-schemas.ts` + mana handler                                                                              |
| `activeRun.rng`                                                                   | fixed fallback seed, zero counters                                                                                                  | `save-schemas/active-run.ts`                                                                                         |
| `activeRun` shop fields                                                           | only the active shop visit is encoded; legacy screen fields still decode                                                            | `encodePersistedShops`; repair across normalize → shop hydrate → `restoreRunSession`                                 |
| `activeRun.starterDraftChoices`                                                   | `null` on wildwood; the gauntlet re-drafts on entry                                                                                 | `encodeActiveRunFromSession`                                                                                         |
| `activeRun.mysteryVisit`                                                          | kept only while `currentScreen` is mystery                                                                                          | `normalizeActiveRunData`                                                                                             |
| Draft/mystery choice repair                                                       | re-offered from the live pool on empty                                                                                              | `normalizeActiveRunData`                                                                                             |
| `activeCombat.pendingBattleTransition`                                            | `null`; legacy enemy phases recover to a playable turn                                                                              | battle resume codec                                                                                                  |
| `activeRun.activeLabyrinthModifiers` / `activeRun.activeLabyrinthRewardModifiers` | `[]`; expedition-level twists persist outside combat, backfilled from `activeCombat` on old saves, top-level wins on divergence     | `save-schemas/active-run.ts` + `normalizeActiveRunData`                                                              |
| `parkedRuns` / `runRecency`                                                       | empty; corrupt slots drop without wiping the save                                                                                   | run codecs                                                                                                           |
| `gold` / `runMetaMaxHealth`                                                       | foreground combat Gold supplies purse recovery; parked combat never overrides the purse; `runMetaMaxHealth: 0` means `runMaxHealth` | `save-schemas/save-data.ts`                                                                                          |
| `backgroundParticlesIntensity` / `backgroundGlowIntensity`                        | `100` (full); clamped to `0–100`; `0` hides the layer                                                                               | settings store (`settings-store.ts`) + `save-schemas/save-data.ts`                                                   |
| `gearInventories` / `gearLoadouts`                                                | empty inventories and loadouts; loadouts pruned of orphan references                                                                | `gear-store-initial-state.ts` (`createEmptyGearInventories`/`Loadouts`) + `save-schemas/save-data.ts` orphan pruning |
| `ownedTrinketIds` / `equippedTrinkets`                                            | empty ownership; equipment normalized for exclusivity against owned IDs                                                             | `gear-actions.ts` (`initializeGear`) + `save-schemas/save-data.ts` orphan pruning                                    |
| `craftingCurrencies`                                                              | zeroed currency record                                                                                                              | `crafting-ids.ts` (`normalizeCraftingCurrencies`)                                                                    |

## Public save contract

The supported floor may move only when the team deliberately drops an
unsupported local shape. Once public saves exist, freeze that floor. Every bump
to `CURRENT_SAVE_SCHEMA_VERSION >= LAUNCH_SAVE_SCHEMA_VERSION` is a
save-compat commitment: a player upgrading from any supported build must be
able to load and play the existing save.

### Policy: local is authoritative

Steam Cloud is a one-way mirror. Writes go local-first (atomic, with backup-ring rotation in `desktop/main.cjs` — `save.json` + `bak.1-3` + `tmp`) and then mirror to Steam Cloud.

Device display preferences (`alchemy-device-display-v1`) stay outside the versioned save: they survive save wipes, are never cloud-mirrored, and never gate loads.

#### Load selection

`src/lib/platform-save-backend.ts#createPlatformSaveBackend` collects candidates in preference order (local → bak.1 → bak.2 → bak.3 → cloud); `uniqueCandidates` deduplicates identical Cloud mirrors. The freshest playable candidate that Zod-validates wins by `lastSavedAt`; corrupt candidates fall through to another recovery source. Evaluation is deterministic in `src/features/alchemy/shared/storage/save-candidates.ts#evaluateSaveCandidates`. Recovery diagnostics are logged at the I/O seam, and only the winning candidate is hydrated against the live catalog.

#### Future schema saves

Saves with a schema newer than the current build are intentionally not migrated or overwritten. A recognizable future-versioned candidate protects the session only when it is fresher by `lastSavedAt` than every playable candidate. A stale newer-versioned mirror is skipped in favor of the freshest playable backup; timestamp ties also load the playable backup, and autosave can continue.

When protection applies, the load path returns session defaults and disables autosave writes so an older build cannot destroy newer progress. The Save Protected screen offers update guidance and an explicit “Delete local save and continue” escape hatch under the [deletion policy](#deletion).

#### Write acknowledgement

Normal saves and explicit flushes return `saved`, `failed`, or `skipped`. `saved` means local storage accepted that snapshot or a newer coalesced replacement; a cloud-mirror failure remains non-fatal. Serialization and backend failures are logged at the I/O seam and returned to the caller.

Autosave retains unacknowledged changes until a covering write succeeds. In-memory revisions prevent an older completion from clearing newer progress. Failed writes retry through the existing single timer no sooner than 10 seconds after failure, including when animations are disabled or new changes arrive. Timing math lives in `src/app/autosave-scheduler.ts` with unit coverage; the React hook owns only subscriptions and lifecycle listeners. Exit signals may bypass that cooldown. Clear requests and write protection invalidate pending acknowledgements and cancel scheduled autosaves; disabled persistence and hook cleanup also stop retries. A late completion cannot restart cancelled work. No scheduling metadata is persisted.

Browser lifecycle exits (`visibilitychange`, `pagehide`, and `beforeunload`) synchronously flush the latest unacknowledged snapshot to `localStorage` via `writeSync`. A successful synchronous flush returns `saved` immediately when the queue is idle. If an older write may still land, the latest snapshot also replaces pending queue work and completion waits for that final write. Desktop IPC uses the same serialized coalescing queue and returns a promise for the actual write outcome. A failed synchronous exit remains retryable while mounted. Desktop shutdown remains best effort, so earlier visibility/pagehide signals give IPC time to finish before the window closes. Terminal saves supersede queued snapshots that have not started writing.

#### Deletion

Deletion order is selected by the operation, not by the visible screen.
When Steam Cloud is enabled, the desktop backend supports two paths:

- **Default backend clear:** delete the Cloud mirror first, then local data.
  Cloud deletion failure leaves local data untouched and reports failure,
  preventing a surviving mirror from silently restoring a deleted save.
- **Explicit local wipe (`forceLocalWipe: true`):** clear local candidates
  (`save.json`, `bak.1–3`, and `tmp`) first, then attempt Cloud deletion
  best-effort. Local failure reports failure without deleting Cloud data;
  Cloud failure after a successful local wipe is logged but does not prevent
  success. The next successful mirror write replaces any residual Cloud save.

Options' clear-save action explicitly requests the local-wipe path, even during
normal play. When no override is supplied, `clearAlchemySaveData` selects that
path if writes are disabled, including Save Protected; otherwise it uses the
default backend clear. Browser deletion removes local storage only.

Dev builds also accept `?wipeLocalSave=1` to clear before bootstrap. Device display preferences survive either deletion path.

### Load order

Five stages, in load order: **migrate** (versioned shape and content-ID steps) → **validate** (Zod object schemas) → **normalize** (`normalizeActiveRunData` strips retired cards against the live catalog and soft-fixes valid shapes, e.g. re-offering emptied choice lists) → **hydrate** (`hydrateCard`, shop and Gear catalog filters, `initializeGear` + owned-unique union) → **restore** (ownership filtering in `restoreRunSession`). Never put rename logic in Zod transforms.

### Implementation rules

- Schema migration steps cover `LAUNCH_SAVE_SCHEMA_VERSION → CURRENT_SAVE_SCHEMA_VERSION` only. Do not remove a supported step without raising `LAUNCH_SAVE_SCHEMA_VERSION` in the same change.
- Card IDs that disappear from the live catalog are stripped against the live catalog at load in `normalize-active-run-data.ts`. Record deliberate removals in `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts` so fixtures stay explicit. The guard test in `save-migration-guard.test.ts` checks `discoveredCardIds` for catalog or tombstone membership; deck, shop, battle, mystery, and corruption piles rely on silent live-catalog stripping without a tombstone requirement.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. The run always has a valid, drawable set of cards. No player-facing diagnostics.
- Card validation and hydration treat saved effects and descriptions as one content unit. `BattleCardSchema` returns an empty effect list if any effect fails validation, including nested effects; missing or malformed lists likewise become empty. `hydrateCard` preserves both saved lists only when both are usable, without comparing their lengths against the current catalog. Otherwise it restores both from the library and clears saved `corrupted`, `baseTitle`, and `corruptedValuePositions`. Valid saved cost, UID, and explicit Consume overrides survive; title, art, and catalog metadata refresh from the library. The empty-list recovery signal survives normalization and JSON round trips without extra saved fields.
- The same card validator covers active-run card locations and saved battle deck, hand, discard, exhausted, Wish options, and Wish queue, including pending battle result states. Battle card hydration occurs when `initializeActiveBattle` restores the session; other card locations hydrate through `toActiveRunData`. Complete valid saved modifications survive even when their effect count differs from current content. Incomplete content recovery may reset card modifications, but requires no schema bump because the persisted shape and valid values retain their meanings.
- The `SaveLoadStatus` shape has four variants: `ok`, `unsupported-newer-schema`, `unsupported-newer-content`, and `corrupt`. No diagnostic fields surface to the player.
