# Save Migration Guide

## Supported baseline

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the minimum supported format. The single-run baseline is the current schema; development formats below it are disposable. `evaluateSaveCandidates` rejects those candidates before permissive field validation can stamp defaults. If no supported or protecting future candidate remains, load defaults through the normal save path without explicitly clearing backup or Cloud sources. Do not salvage old profiles or parked runs.

Game build identity is distinct from schema and content versions. Ordinary compatible builds do not reset saves. Freeze the supported floor at the first distribution whose progress is promised to persist, including a playtest or Early Access release. Preserve subsequent supported formats. Version sources are split: the build version is generated from `package.json` by `scripts/sync-version-metadata.mjs`, while schema and content versions are hardcoded in `src/lib/validation/metadata.ts`.

## When to increment

Increment the schema version for structural or meaning changes that require a supported payload transformation. Do not bump for safe additive defaults. Content versions are reserved for content ID/meaning remaps, not ordinary balance tuning. The baseline removes historical transforms; `migration/index.ts` retains raw-version readers and future protection. Add only transformations for supported formats when those become necessary.

## Required pattern (automated)

1. Decide whether a compatible default or supported transformation is required.
2. Change version metadata only as required; never advance the supported floor casually.
3. For a supported transformation, (re)introduce an ordered migration table covering every increment and apply it before current-shape validation. Update schema and hydration defaults together.
4. Change the save shape, its codec, its fixtures, and `RUN_PROFILE_SAVE_KEYS` together: the run-profile key list is an explicit tuple with a compile-time completeness check, so adding a `PermanentProgressFields` member fails the build until the save contract is updated deliberately.
5. Add previous-version fixtures to `tests/fixtures/current-saves.ts` when supported versions diverge. Preserve playable state and progression, not just field presence. The migration contract test pins the floor while no migrations are pending.
6. Run the changed-path gate, which selects the full save/persistence suite.

## Test expectations

Current saves must round-trip valid profile progress, inventories/loadouts, current-run geography, deck modifications, choices, and captured battle results/RNG. Test malformed current fields, an invalid run alongside a valid profile, stale autosaves after run end, and future-candidate precedence. Historical below-baseline tests are retired; `save-migration-guard.test.ts` covers baseline rejection and current recovery.

Run activity and resume codecs preserve a single `activeRun`. Opening draws and turns commit before animation. Pending battle result fields remain readable and are consumed once; do not reroll or duplicate awards. No parked-run or recency fields are saved. Keep run/profile/gear codecs explicit so a broad envelope cannot overwrite another owner's live fields.

## Progression gate fields

Choose the intended new-player default. Safe additive fields retain that default and valid saved values; transformations of supported progress require versioned evidence and gameplay assertions. Current authoring validation remains strict and separate from load-tolerant recovery.

## Content changes without a save bump

Preserve complete saved card effects, descriptions, and explicit Consume overrides together. Incomplete card content recovers from the live catalog. Gear/loadout ownership cleanup, native enemy Trait refresh, current catalog filtering, and safe manifest defaults remain current-data repair, not historical migrations. Stored Unique affix rolls are dropped at normalization in favor of the canonical catalog affixes; pre-release material renames (gems to crystal) and additions (stone, hide) resolve through schema defaults, not aliases or migrations. Persisted battle scalars and collections repair field-by-field to battle defaults; a battle block without any card piles is a fragment, not a fight, and drops the combat session instead of fabricating one. Battle telemetry is runtime-only and is never persisted.

## Defaults and resume normalization

`createDefaultSaveData()` (`storage/defaults.ts`) is the single defaults owner and delegates to `SaveDataSchema.parse({})`, so codec defaults, schema `.catch` defaults, and fixtures cannot drift; the migration contract test pins key/value alignment. Validation supplies safe current-field defaults. Normalization repairs current-run choices and catalog references; hydration restores runtime cards and manifests. Preserve valid saved card modifications, Health, defenses, flags, pending choices, and RNG. Never reapply starting grants or resolve an action during normalization. Keep material defaults and current field names; retired crystal/recovery and historical Talent conversions are no longer accepted as aliases. Live combat gold intentionally overrides the purse when finite and non-negative; that override is not a repair warning.

## Public save contract

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

Autosave retains unacknowledged changes until a covering write succeeds. In-memory revisions prevent an older completion from clearing newer progress. Failed writes retry through the existing single timer no sooner than `AUTOSAVE_MAX_WAIT_MS` after failure (see `src/lib/game-constants/storage.ts`), including when animations are disabled or new changes arrive. Timing math lives in `src/app/autosave-scheduler.ts` with unit coverage; the React hook owns only subscriptions and lifecycle listeners. Exit signals may bypass that cooldown. Clear requests and write protection invalidate pending acknowledgements and cancel scheduled autosaves; disabled persistence and hook cleanup also stop retries. A late completion cannot restart cancelled work. No scheduling metadata is persisted.

Browser lifecycle exits (`visibilitychange`, `pagehide`, and `beforeunload`) synchronously flush the latest unacknowledged snapshot to `localStorage` via `writeSync`. A successful synchronous flush returns `saved` immediately when the queue is idle. If an older write may still land, the latest snapshot also replaces pending queue work and completion waits for that final write. No await sits between the sync write and the idle check, so check-and-enqueue is atomic on the event loop. Each physical write stamps its own `lastSavedAt` at serialization time. Desktop IPC uses the same serialized coalescing queue and returns a promise for the actual write outcome. A failed synchronous exit remains retryable while mounted. Desktop shutdown remains best effort, so earlier visibility/pagehide signals give IPC time to finish before the window closes. Terminal saves supersede queued snapshots that have not started writing.

#### Deletion

Deletion mode is explicit (`"default"` | `"localWipe"` | `"wipeForReload"`), not inferred from the visible screen or write protection:

- **`default`:** delete the Cloud mirror first, then local data.
  Cloud deletion failure leaves local data untouched and reports failure,
  preventing a surviving mirror from silently restoring a deleted save.
- **`localWipe`:** clear local candidates
  (`save.json`, `bak.1–3`, and `tmp`) first, then attempt Cloud deletion
  best-effort. Local failure reports failure without deleting Cloud data;
  Cloud failure after a successful local wipe is logged but does not prevent
  success. The next successful mirror write replaces any residual Cloud save.
  Options' clear-save action and deliberate resets use this path.
- **`wipeForReload`:** same forced local wipe as `localWipe`, but keeps writes
  disabled so a terminal flush cannot resurrect the save before reload. The
  Save Protected escape hatch uses this path.

Browser deletion removes local storage only.

Dev builds also accept `?wipeLocalSave=1` to clear before bootstrap. Device display preferences survive either deletion path.

### Load order

Candidate compatibility/freshness checks → current-shape validation → normalization → hydration → restore. If supported versions ever diverge, migration steps execute after compatibility checks and before validation. `SaveDataSchema` is a load-tolerant shape validator; raw-version acceptance belongs to candidate evaluation and must occur first. Test-only direct parsing is not the compatibility gate.

### Implementation rules

- Card IDs that disappear from the live catalog are stripped against the live catalog at load in `normalize-active-run-data.ts`. Record deliberate removals in `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts` so fixtures stay explicit. The guard test in `save-migration-guard.test.ts` checks `discoveredCardIds` for catalog or tombstone membership; deck, shop, battle, mystery, and corruption piles rely on silent live-catalog stripping without a tombstone requirement.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. The run always has a valid, drawable set of cards. No player-facing diagnostics.
- Card validation and hydration treat saved effects and descriptions as one content unit. `BattleCardSchema` returns an empty effect list if any effect fails validation, including nested effects; missing or malformed lists likewise become empty. `hydrateCard` preserves both saved lists only when both are usable, without comparing their lengths against the current catalog. Otherwise it restores both from the library and clears saved `corrupted`, `baseTitle`, and `corruptedValuePositions`. Valid saved cost, UID, and explicit Consume overrides survive; title, art, and catalog metadata refresh from the library. The empty-list recovery signal survives normalization and JSON round trips without extra saved fields.
- The same card validator covers active-run card locations and saved battle deck, hand, discard, exhausted, Wish options, and Wish queue, including pending battle result states. Battle card hydration occurs when `initializeActiveBattle` restores the session; other card locations hydrate through `toActiveRunData`. Complete valid saved modifications survive even when their effect count differs from current content. Incomplete content recovery may reset card modifications, but requires no schema bump because the persisted shape and valid values retain their meanings.
- The `SaveLoadStatus` shape has four variants: `ok`, `unsupported-newer-schema`, `unsupported-newer-content`, and `corrupt`. No diagnostic fields surface to the player.
