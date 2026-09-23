# Save Migration Guide

## Supported baseline

There are currently no historical player saves that must be preserved. Remove code
that exists only to retain obsolete saved mechanics rather than maintaining parallel
rulesets. Resumed battles must use current rules; restart or exit an incompatible
battle instead of continuing legacy gameplay. Keep current-format save/resume correct.
Freeze a supported baseline only when player progress is explicitly promised.
Current-run modifications (Corrupted cards, upgrades, and Mixed Potions) remain
valid save data and must round-trip together with their descriptions. Existing
compatibility readers described below record implementation, not a promise to
retain retired mechanics. Remove their consumers and fixtures together when
retiring them, keeping current-format resume and future-save protection intact.

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the minimum supported format. Version 19 is the single-run baseline; version 20 stores the resolved Mystery offer and migrates version 19 visits before validation. Development formats below the floor are disposable. `evaluateSaveCandidates` rejects those candidates before permissive field validation can stamp defaults. If no supported or protecting future candidate remains, load defaults without explicitly clearing backup or Cloud sources. A retired-format payload can be replaced by the next normal save; new progress is routed away from a newer-format payload when another slot is available. Do not salvage old profiles or parked runs.

Game build identity is distinct from schema and content versions. Ordinary compatible builds do not reset saves. Freeze the supported floor at the first distribution whose progress is promised to persist, including a playtest or Early Access release. Preserve subsequent supported formats. Version sources are split: the build version is generated from `package.json` by `scripts/sync-version-metadata.mjs`, while schema and content versions are hardcoded in `src/lib/validation/metadata.ts`.

## When to increment

Increment the schema version for structural or meaning changes that require a supported payload transformation. Do not bump for safe additive defaults. Content versions are reserved for content ID/meaning remaps, not ordinary balance tuning. The baseline removes historical transforms; `migration/index.ts` retains raw-version readers and future protection. Add only transformations for supported formats when those become necessary.

## Required pattern (automated)

1. Decide whether a compatible default or supported transformation is required.
2. Change version metadata only as required; never advance the supported floor casually.
3. For a supported transformation, (re)introduce an ordered migration table covering every increment and apply it before current-shape validation. Update schema and hydration defaults together.
4. Change the save shape, its codec, its fixtures, and `RUN_PROFILE_SAVE_KEYS` together: the run-profile key list is an explicit tuple with a compile-time completeness check, so adding a `PermanentProgressFields` member fails the build until the save contract is updated deliberately.
5. Add previous-version fixtures to `tests/fixtures/current-saves.ts` when supported versions diverge. Preserve playable state and progression, not just field presence. The migration contract test checks every supported increment. The version 19 Mystery fixture exercises the version 20 offer migration; gear/currency coverage lives in the `gear-save` / `save-data-schema` suites.
6. Run the changed-path gate, which selects the full save/persistence suite.

## Test expectations

Current saves must round-trip valid profile progress, inventories/loadouts, current-run geography, deck modifications, choices, and captured battle results/RNG. Test malformed current fields, an invalid run alongside a valid profile, stale autosaves after run end, and future-candidate precedence. Historical below-baseline tests are retired; `save-migration-guard.test.ts` covers baseline rejection and current recovery.

Run activity and resume codecs preserve a single `activeRun`. Opening draws and turns commit before animation. Pending battle result fields remain readable. `shared/stores/battle-restore.ts` consumes them inside hydration, including outstanding world-stream work and XP; live state contains only the resolved snapshot. New saves retain the wire field as null, so this requires no schema bump. Preserve terminal active battles until their outcome settles, and do not reroll or duplicate awards. No parked-run or recency fields are saved. Keep run/profile/gear codecs explicit so a broad envelope cannot overwrite another owner's live fields.

## Progression gate fields

Choose the intended new-player default. Safe additive fields retain that default and valid saved values; transformations of supported progress require versioned evidence and gameplay assertions. Current authoring validation remains strict and separate from load-tolerant recovery.

## Content changes without a save bump

Preserve valid current-run card effects, descriptions, and explicit Consume overrides together under the [supported baseline](#supported-baseline). Incomplete card content recovers from the live catalog. Gear/loadout ownership cleanup, native enemy Trait refresh, current catalog filtering, and safe manifest defaults remain current-data repair, not historical migrations. Stored Unique affix rolls are dropped at normalization in favor of the canonical catalog affixes; pre-release material renames (gems to crystal, then crystal to gems) and additions (stone, hide) resolve through schema defaults, not aliases or migrations. Persisted battle scalars and collections repair field-by-field to battle defaults, while enemy identity and display data come from the live catalog. A battle block without any card piles or a known enemy is a fragment, not a fight, and drops the combat session instead of fabricating one; the run remains playable and load reports a battle-repair warning. Battle telemetry is runtime-only and is never persisted.

Reworked Talents may retain their IDs, while current run restoration rebinds derived manifests from purchased IDs and Homestead effects. Remove retired manifest keys and their gameplay branches instead of preserving legacy battle behavior. Use defaults for compatible additions and retire incompatible development snapshots when required. Shop state adds `freeRefreshUsed` with a false default and field-by-field hydration for older saves. Restock rolls the shop RNG before affordability, but a successful free refresh still commits atomically and consumes one refresh slot. The additive `hawkEyeReady`, `archeryCardsPlayedThisTurn`, `archerySecondCardActive`, `firstBurnCardFreeUsed`, and `nextPhysicalCrit` battle flags default safely, normalize to their declared boolean/number types, and persist across turns and resume. Hawk Eye and Riposte readiness are never reconstructed from existing status or Dodge state, and new opening draws/rewards are never replayed during normalization. All new flags reset with a new battle.

## Run recap tracking

Active runs add `runHistory`, `runHistoryPartial`, and nullable `runGoldEarned` with
safe additive defaults; no schema bump is required. New runs start with empty complete
history and zero earned Gold. Older runs default to empty partial history and unknown
Gold (`null`): subsequent visits are recorded with an omitted-history marker, while
Gold remains unknown until a fresh run. Never infer missing earnings from the purse.
History and earnings round-trip with the active run; loading never records visits or
replays earnings. The detached `runRecap` ending snapshot is session-only and does not
resurrect a saved run after death, abandonment, or victory.

## Defaults and resume normalization

`createDefaultSaveData()` (`storage/defaults.ts`) is the top-level defaults owner: the Zod schema is parsed once into a frozen singleton and every caller receives a fresh clone, so top-level keys and values cannot drift (pinned by the migration contract test). Domain codec defaults must still be updated together: `createDefaultSettingsSaveFields` (`shared/stores/settings-store.ts`), `createDefaultProfileSaveFields` (`shared/stores/profile-store-types.ts`), `createInitialGearState` (`shared/stores/gear-actions.ts`), and `createInitialPermanentFields` (`shared/stores/run-state-init.ts`), plus both fixture builders (`tests/fixtures/saves.ts` campaign-full, `tests/helpers/save-candidate-fixtures.ts` candidate-minimal). Validation supplies safe current-field defaults. Normalization repairs current-run choices and catalog references; hydration restores runtime cards and manifests. Repair happens in two layers with distinct owners: schema load-repair (`SaveDataSchema` transform in `save-data.ts`: live-combat gold override, autoplay derive, orphan gear-loadout prune) runs first, then codec hydrate-repair (`hydrateAlchemyPersistenceFields` in `storage/persistence.ts` plus run-profile codec: unknown-companion prune, homestead effects, unique ownership union). Preserve valid saved card modifications, Health, defenses, flags, pending choices, and RNG. Never reapply starting grants or resolve an action during normalization. Keep material defaults and current field names; retired crystal/recovery and historical Talent conversions are no longer accepted as aliases. Live combat gold intentionally overrides the purse when finite and non-negative; that override is not a repair warning.

## Public save contract

Local storage is authoritative; Cloud is a mirror. Choose playable candidates by freshness, and preserve unreadable or newer-format data in its existing slot while current play writes a safe slot. A save succeeds only when a local write acknowledges the snapshot or a newer replacement. Deletion has explicit modes; pending writes must not resurrect deleted data. Save problems do not block play or ask the player to make a recovery choice.

Read the applicable contract before changing its behavior:

- [Loading and candidate selection](#load-selection), including [load order](#load-order).
- [Compatibility and future protection](#future-schema-saves), plus [when to increment](#when-to-increment).
- [Write acknowledgement and autosave](#write-acknowledgement).
- [Deletion modes](#deletion).
- [Local/Cloud policy](#policy-local-is-authoritative) and [content repair rules](#implementation-rules).

## Policy: local is authoritative

Steam Cloud is a one-way mirror. Both the primary (`save.json`) and recovery (`save-recovery.json`) slots write local-first, atomically with their own `bak.1-3` ring and `tmp` in `desktop/main.cjs`, then mirror to the matching Cloud filename. Browser storage uses the primary `alchemy-save-v1` and recovery `alchemy-save-recovery-v1` keys.

Device display preferences (versioned `alchemy-device-display-v<n>` key, currently v1) stay outside the versioned save: they survive save wipes, are never cloud-mirrored, and never gate loads. A version mismatch resets them to defaults silently (no error-sink entry); only unreadable storage or corrupt JSON is logged.

## Load selection

`readDesktopCandidates` in `src/lib/platform-save-backend.ts` collects each slot in preference order (local ring → Cloud). The local ring read order lives in `desktop/main.cjs`; the backend appends the matching Cloud mirror and deduplicates identical payloads. The storage owner evaluates primary candidates before recovery candidates, and the freshest playable candidate that Zod-validates wins by `lastSavedAt`; corrupt candidates fall through to another source. Evaluation is deterministic in `src/features/alchemy/shared/storage/save-candidates.ts#evaluateSaveCandidates`. Recovery diagnostics are logged at the I/O seam, and only the winning candidate is hydrated against the live catalog.

Routine skips stay silent: missing, empty, and below-baseline candidates on fresh profiles never reach the error sink (`logStorageFailure`), because browser journeys assert zero runtime errors. Non-object roots and genuinely corrupt JSON do report. Candidate validation reports genuinely corrupt JSON and schema failures of otherwise versioned candidates; storage I/O failures are logged separately. Pinned by `save-version-protection.test.ts`.

A failed local candidate read is different from an empty or corrupt candidate set. Desktop still attempts the Cloud copy; the storage owner tries both slots and uses any compatible candidate it can read. If the primary is unreadable, new progress writes to the recovery slot, leaving the primary untouched. If neither slot can be read, play starts with defaults and writes still attempt the recovery slot. If a normal primary write fails, the same snapshot is attempted in recovery before autosave reports failure and retries. The player sees no save-problem screen. When all storage writes fail, progress remains in memory for that session and autosave keeps retrying; durability cannot be promised until some storage accepts a write.

## Future schema saves

Saves with a schema or content version newer than the current build are intentionally not migrated. Any playable candidate wins over a newer-format candidate, even when the newer copy has a later timestamp, so a compatible backup or recovery copy can still resume play. If no playable candidate exists, load defaults. The storage owner routes writes away from a slot holding newer-format data when another slot is available.

When only one slot holds newer-format candidates, new saves use the other slot, leaving the newer data untouched. If both slots hold incompatible data, the recovery ring remains the best available write target; older recovery backups can eventually rotate out. A later build evaluates both slots again and selects the freshest playable candidate. No player-facing save decision is required.

Tie rules: playable-vs-playable ties keep the first candidate in read order — primary local ring, primary Cloud, recovery local ring, then recovery Cloud. Future-vs-future ties likewise keep the first candidate in read order for internal diagnostics. Fractional `lastSavedAt` values floor before comparison; missing timestamps fall back per domain (`-1` for future, `0` for the playable pre-filter matching the schema default) via `getCandidateSavedAt`.

## Write acknowledgement

Normal saves and explicit flushes return `saved`, `failed`, or `skipped`. `saved` means local storage accepted that snapshot or a newer coalesced replacement in the active slot; a Cloud-mirror failure remains non-fatal. A failed primary write tries the recovery slot with the same snapshot. Serialization and backend failures are logged at the I/O seam and returned to the caller.

Autosave retains unacknowledged changes until a covering write succeeds. In-memory revisions prevent an older completion from clearing newer progress. Failed writes retry through the existing single timer no sooner than `AUTOSAVE_RETRY_COOLDOWN_MS` after failure (see `src/lib/game-constants/storage.ts`; kept equal to `AUTOSAVE_MAX_WAIT_MS` so the backoff survives shrunken debounces, split so UX timing and retry backoff can diverge later), including when animations are disabled or new changes arrive. Timing math lives in `src/app/autosave-scheduler.ts` with unit coverage; `src/app/autosave-lifecycle.ts` owns debounce selection, snapshot building, completion gating, and subscriptions for both React and headless callers; the React hook adds browser lifecycle listeners. Exit signals may bypass that cooldown, with an exit-once latch per revision so back-to-back exit events write one snapshot. Clear requests and write protection invalidate pending acknowledgements and cancel scheduled autosaves; disabled persistence and hook cleanup also stop retries. A late completion cannot restart cancelled work. No scheduling metadata is persisted.

Browser lifecycle exits (`visibilitychange`, `pagehide`, and `beforeunload`) synchronously flush the latest unacknowledged snapshot to `localStorage` via `writeSync`. A successful synchronous flush returns `saved` immediately when the queue is idle. If an older write may still land, the latest snapshot also replaces pending queue work and completion waits for that final write. No await sits between the sync write and the idle check, so check-and-enqueue is atomic on the event loop (see `SaveStorage.flushSerializedExitSave` in [save-storage.ts](./save-storage.ts), the owner of this ordering; `io.ts` delegates exit saves to that storage instance). Each physical write stamps its own `lastSavedAt` at serialization time. Desktop IPC uses the same serialized coalescing queue and returns a promise for the actual write outcome. A failed synchronous exit remains retryable through the scheduler retry while mounted. Desktop shutdown remains best effort, so earlier visibility/pagehide signals give IPC time to finish before the window closes. Terminal saves supersede queued snapshots that have not started writing.

## Deletion

Deletion mode is explicit (`"default"` | `"localWipe"`), not inferred from the visible screen:

- **`default`:** delete both Cloud mirrors first, then both local slots.
  Cloud deletion failure leaves local data untouched and reports failure,
  preventing a surviving mirror from silently restoring a deleted save.
- **`localWipe`:** clear both local candidate rings
  (`save.json` and `save-recovery.json`, each with `bak.1–3` and `tmp`) first, then attempt Cloud deletion
  best-effort. Local failure reports failure without deleting Cloud data;
  Cloud failure after a successful local wipe is logged but does not prevent
  success. The next successful mirror write replaces any residual Cloud save.
  Options' clear-save action and deliberate resets use this path.
  Browser deletion removes both local storage keys only.

Dev builds also accept `?wipeLocalSave=1` (exact value) to clear local candidates via the `localWipe` path. The backend is configured (Steam/cloud state) before the wipe runs, so a desktop dev wipe honors cloud sync instead of leaving a stale Cloud mirror eligible for reload. Device display preferences survive either deletion path.

## Load order

Candidate compatibility/freshness checks → current-shape validation → normalization → hydration → restore. If supported versions ever diverge, migration steps execute after compatibility checks and before validation. `SaveDataSchema` is a load-tolerant shape validator; raw-version acceptance belongs to candidate evaluation and must occur first. Test-only direct parsing is not the compatibility gate. Repair happens in two layers with distinct owners: schema load-repair (`SaveDataSchema` transform) runs inside candidate evaluation, then codec hydrate-repair (`hydrateAlchemyPersistenceFields` in `storage/persistence.ts` plus the run-profile codec) runs at restore; candidate evaluation only hydrates the active-run deck via `toActiveRunData`.

## Implementation rules

- Card IDs that disappear from the live catalog are stripped against the live catalog at load in `normalize-active-run-data.ts`. Record deliberate removals in `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts` so fixtures stay explicit. The guard test in `save-migration-guard.test.ts` checks `discoveredCardIds` for catalog or tombstone membership; deck, shop, battle, mystery, and corruption piles rely on silent live-catalog stripping without a tombstone requirement.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. Filtering can leave an empty deck; the battle engine handles empty piles through Emergency Wish. No player-facing diagnostics.
- Card validation and hydration treat saved effects and descriptions as one content unit. `BattleCardSchema` returns an empty effect list if any effect fails validation, including nested effects; missing or malformed lists likewise become empty. `hydrateCard` preserves both saved lists only when both are usable, without comparing their lengths against the current catalog. Otherwise it restores both from the library and clears saved `corrupted`, `baseTitle`, and `corruptedValuePositions`. Valid saved cost, UID, and explicit Consume overrides survive; title, art, and catalog metadata refresh from the library. The empty-list recovery signal survives normalization and JSON round trips without extra saved fields.
- The same card validator covers active-run card locations and saved battle deck, hand, discard, exhausted, Wish options, and Wish queue, including pending battle result states. Battle card hydration occurs when `initializeActiveBattle` restores the session; other card locations hydrate through `toActiveRunData`. Complete valid saved modifications survive even when their effect count differs from current content. Incomplete content recovery may reset card modifications, but requires no schema bump because the persisted shape and valid values retain their meanings.
- Card arrays keep valid entries when a sibling card is malformed, with a developer-facing repair warning for each dropped position. Missing or non-array run decks still invalidate the run. Shop and Alchemist purchase keys follow surviving cards to their new slots. A Wish prompt emptied by malformed or removed cards advances to the next nonempty queued choice, or closes when none remains, so resumed combat stays playable.
- The `SaveLoadStatus` shape has five variants: `ok`, `unavailable`, `unsupported-newer-schema`, `unsupported-newer-content`, and `corrupt`. These are internal diagnostics; none blocks play or opens a save-problem screen. The `ok` variant may carry developer-facing `warnings` (repair notes such as dropped card content); these never gate loads and are not shown to players.

## Four-tier Homestead

Building, farm, and research level bounds come from the current four-tier catalog;
existing levels retain their values and level four survives reload. Companion
Bonds keep three tiers. New numeric Homestead combat fields default to zero in
the talent manifest and rebind from purchased levels during run restoration.
Do not replay opening grants or production while rebinding. Existing Potion
mixtures retain their stored effects; new mixing discounts alter purchase prices,
not saved Potion contents. Stone uses the existing material inventory entry;
Gold production uses the purse owner. No material IDs or saved building IDs change.

## Strategic card revisions

Conditional-damage fields and card hydration currently accept complete saved
effects and descriptions, so changing the catalog alone does not update a saved
card. Preserve valid current-run modifications together, but do not retain old
Shield Bash, Maul, or Ice Shot mechanics solely for development saves. Apply the
[supported baseline](#supported-baseline) when a revision makes a snapshot
incompatible, restarting or exiting its battle rather than continuing obsolete
rules. Merge clocks, width reservations, and floating sums are presentation-only
and never enter saves.

## Screen-effect settings

`screenEffects` owns the master enable flag and independent `scanlines`, `tint`,
`edges` and `grain` records. `backgroundLights` independently owns its own enabled,
strength, and motion fields alongside the other background preferences. Each record has enabled and strength fields,
with spacing, color, or motion only where relevant. Defaults and field-level
normalization live in `lib/screen-effect-settings.ts` and are shared by save
validation and the settings codec. Missing or malformed values default safely;
finite strengths clamp to 0–100. The master and every effect default off.

The experimental preset model was removed before any saves required compatibility;
there is deliberately no conversion or legacy preset data in the saved settings.

## Shared run-progress shape

`lib/validation/save-schemas/run-progress.ts` owns progression schema fields and legacy recovery defaults. `PersistedRunProgress` and `ACTIVE_RUN_PROGRESS_KEYS` derive from it; `ActiveRunData` extends the shared wire fields and `ActiveRunProgressFields` narrows destination names for live state. Saved callers remain permissive about historical destination names until normalization. Fresh-run constructors still own starting decks, seeded RNG, fresh collection instances and zero earned totals. Legacy missing `runHistoryPartial`/`runGoldEarned` still recover as `true`/`null`; never replace those with fresh-run defaults. New progress fields require their schema and meaningful fresh/resume initialization, without a duplicate wire/live declaration or key-list edit.
