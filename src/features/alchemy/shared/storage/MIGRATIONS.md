# Save Migration Guide

## Supported baseline

Battle snapshots include `pendingCardBleedLeechHealing`, the explicit-card subset
of queued Bleed Leech. It defaults to zero and cannot exceed the total queued
Leech. New snapshots preserve that attribution through ticks, detonations, and
resume so Deep Siphon applies only to card-origin Leech. This additive field does
not change the save version.

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

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the minimum supported format. Version 19 is the single-run baseline; version 20 stores the resolved Mystery offer; version 21 replaces flattened resume fields with one activity. Versions 19 and 20 migrate before current-shape validation. Development formats below the floor are disposable. `evaluateSaveCandidates` rejects those candidates before permissive field validation can stamp defaults. If no supported or protecting future candidate remains, load defaults without explicitly clearing backup or Cloud sources. A retired-format payload can be replaced by the next normal save; new progress is routed away from a newer-format payload when another slot is available. Do not salvage old profiles or parked runs.

Game build identity is distinct from schema and content versions. Ordinary compatible builds do not reset saves. Freeze the supported floor at the first distribution whose progress is promised to persist, including a playtest or Early Access release. Preserve subsequent supported formats. Version sources are split: the build version is generated from `package.json` by `scripts/sync-version-metadata.mjs`, while schema and content versions are hardcoded in `src/lib/validation/metadata.ts`.

## When to increment

Increment the schema version for structural or meaning changes that require a supported payload transformation. Do not bump for safe additive defaults. Content versions are reserved for content ID/meaning remaps, not ordinary balance tuning. The baseline removes below-floor historical transforms; `migration/index.ts` owns the supported version 19-to-20-to-21 transformations, raw-version readers, and future protection. Add only transformations for supported formats.

## Required pattern (automated)

1. Decide whether a compatible default or supported transformation is required.
2. Change version metadata only as required; never advance the supported floor casually.
3. For a supported transformation, (re)introduce an ordered migration table covering every increment and apply it before current-shape validation. Update schema and hydration defaults together.
4. Change the save shape, its owning codec, defaults, and fixtures together. For run-profile fields, also update `RUN_PROFILE_SAVE_KEYS`: this explicit tuple has a compile-time completeness check, so adding a `PermanentProgressFields` member fails the build until that key list is updated. Other domains keep their own codec field selections.
5. Add previous-version fixtures to `tests/fixtures/current-saves.ts` when supported versions diverge. Preserve playable state and progression, not just field presence. The migration contract test checks every supported increment. The version 19 Mystery fixture exercises both supported migrations; gear/currency coverage lives in the `gear-save` / `save-data-schema` suites.
6. Run relevant save/persistence unit suites with `npm run test:full -- <test-paths>` and the [task-scoped gate](../../../../../CONTRIBUTING.md#what-to-run-when-you-change). The opt-in full verifier selects the complete save/persistence suite; the default local gate does not.

## Test expectations

Current saves must round-trip valid profile progress, inventories/loadouts, current-run geography, deck modifications, each activity branch, choices, and committed battle results/RNG. Test malformed current fields, an invalid run alongside a valid profile, stale autosaves after run end, and future-candidate precedence. Historical below-baseline tests are retired; `save-migration-guard.test.ts` covers baseline rejection and current recovery.

Battle difficulty modifiers are validated individually during load. Keep valid
entries and drop malformed ones so the next enemy turn can resolve safely.
Profile and run XP retain only current keyword IDs; unknown entries cannot
contribute Talent points or starting Health.
Saved enemies regain their current native Traits from the catalog and retain
only current combat encounter Traits. Reward benefits stay in their separate
field; unsupported saved Traits cannot enter combat.

Run activity and resume codecs preserve a single `activeRun` with one tagged
`activity`. Opening draws and turns commit before animation. New saves have no
pending-turn, display-screen, interrupted-flow, or separate optional visit fields.
Migration converts valid older runs without executing gameplay. Only the selected
candidate may request abandonment of a nonterminal unfinished legacy battle.
Restore uses current abandonment settlement atomically, then queues the terminal
snapshot; stale bootstrap results cannot abandon an initialized run. Terminal
committed battles remain resumable. Unusable selected activity structure drops
only the run; permanent progress and future-save protection remain intact.
A damaged Mystery offer retains its tag with null data so restore can exit that
visit through the existing repair operation.

## Progression gate fields

Choose the intended new-player default. Safe additive fields retain that default and valid saved values; transformations of supported progress require versioned evidence and gameplay assertions. Current authoring validation remains strict and separate from load-tolerant recovery.

## Content changes without a save bump

Preserve valid current-run card effects, descriptions, and explicit Consume overrides together under the [supported baseline](#supported-baseline). Incomplete card content recovers from the live catalog. Gear/loadout ownership cleanup, native enemy Trait refresh, current catalog filtering, and safe manifest defaults remain current-data repair, not historical migrations. Stored Unique affix rolls are dropped at normalization in favor of the canonical catalog affixes; pre-release material renames (gems to crystal, then crystal to gems) and additions (stone, hide) resolve through schema defaults, not aliases or migrations. Persisted battle scalars and collections repair field-by-field to battle defaults, while enemy identity and display data come from the live catalog. A battle block without any card piles or a known enemy is a fragment, not a fight, and drops the combat session instead of fabricating one; the run remains playable and load reports a battle-repair warning. Battle telemetry is runtime-only and is never persisted.

Reworked Talents may retain their IDs, while current run restoration rebinds derived manifests from purchased IDs and Homestead effects. Remove retired manifest keys and their gameplay branches instead of preserving legacy battle behavior. Battle normalization keeps only declared Talent and combat-flag keys; their defaults own the supported shape. Combat flags retain valid booleans and finite nonnegative numbers, repairing other values to their declared defaults. Use defaults for compatible additions and retire incompatible development snapshots when required. Shop state adds `freeRefreshUsed` with a false default and field-by-field hydration for older saves; refresh affordability, RNG, and visit limits follow the [shop workflow](../../../../../Docs/WORKFLOWS.md#change-a-shop).

Battle flags default safely, normalize to their declared boolean/number types, and preserve their current values on resume. Their turn/combat/until-consumed lifetimes are owned by [combat-flags.ts](../../../../../src/lib/battle/combat-flags.ts): Archery sequence flags reset each player turn, while Hawk Eye and Riposte readiness survive until consumed and the first-Burn-free allowance lasts for the combat. Never reconstruct readiness from existing status or Dodge state, or replay opening draws/rewards during normalization. New battles initialize fresh flags.

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

`selectSaveCandidates(primary, recovery)` inspects each candidate once and returns
the load state together with its safe write-slot recommendation. Compatibility
checks protect every newer-format candidate, including stale copies after the
playable winner. The winning raw payload, validated data, and repair notes stay
together until hydration. `evaluateSaveCandidates` is the single-source facade;
demo import uses the same selection and rejects a protected source. Storage adds
unreadable-primary protection at the I/O boundary.

A failed local candidate read is different from an empty or corrupt candidate set. Desktop still attempts the Cloud copy; the storage owner tries both slots and uses any compatible candidate it can read. If the primary is unreadable, new progress writes to the recovery slot, leaving the primary untouched. If neither slot can be read, play starts with defaults and writes still attempt the recovery slot. If a normal primary write fails, the same snapshot is attempted in recovery before autosave reports failure and retries. The player sees no save-problem screen. When all storage writes fail, progress remains in memory for that session and autosave keeps retrying; durability cannot be promised until some storage accepts a write.

## Future schema saves

Saves with a schema or content version newer than the current build are intentionally not migrated. Any playable candidate wins over a newer-format candidate, even when the newer copy has a later timestamp, so a compatible backup or recovery copy can still resume play. If no playable candidate exists, load defaults. The storage owner routes writes away from a slot holding newer-format data when another slot is available.

When only one slot holds newer-format candidates, new saves use the other slot, leaving the newer data untouched. If both slots hold incompatible data, the recovery ring remains the best available write target; older recovery backups can eventually rotate out. A later build evaluates both slots again and selects the freshest playable candidate. No player-facing save decision is required.

Tie rules: playable-vs-playable ties keep the first candidate in read order — primary local ring, primary Cloud, recovery local ring, then recovery Cloud. Future-vs-future ties likewise keep the first candidate in read order for internal diagnostics. Fractional `lastSavedAt` values floor before comparison; missing timestamps fall back per domain (`-1` for future, `0` for the playable pre-filter matching the schema default) via `getCandidateSavedAt`.

## Write acknowledgement

Normal saves and explicit flushes return `saved`, `failed`, or `skipped`. `saved` means local storage accepted that snapshot or a newer coalesced replacement in the active slot; a Cloud-mirror failure remains non-fatal. A failed primary write tries the recovery slot with the same snapshot. Serialization and backend failures are logged at the I/O seam and returned to the caller.

Autosave retains unacknowledged changes until a covering write succeeds. In-memory revisions prevent an older completion from clearing newer progress. When building a snapshot or writing it fails, autosave retries through the existing single timer no sooner than `AUTOSAVE_RETRY_COOLDOWN_MS` after failure (see `src/lib/game-constants/storage.ts`; kept equal to `AUTOSAVE_MAX_WAIT_MS` so the backoff survives shrunken debounces, split so UX timing and retry backoff can diverge later), including when animations are disabled or new changes arrive. Timing math lives in `src/app/autosave-scheduler.ts` with unit coverage; `src/app/autosave-lifecycle.ts` owns debounce selection, snapshot building, completion gating, and subscriptions for both React and headless callers; the React hook adds browser lifecycle listeners. Exit signals may bypass that cooldown, with an exit-once latch per revision so back-to-back exit events write one snapshot. Clear requests and write protection invalidate pending acknowledgements and cancel scheduled autosaves; disabled persistence and hook cleanup also stop retries. Late timer callbacks and write completions cannot restart cancelled work or flush a disposed lifecycle. No scheduling metadata is persisted.

Browser lifecycle exits (`visibilitychange`, `pagehide`, and `beforeunload`) synchronously flush the latest unacknowledged snapshot to `localStorage` via `writeSync`. A successful synchronous flush returns `saved` immediately when the queue is idle. If an older write may still land, the latest snapshot also replaces pending queue work and completion waits for that final write. No await sits between the sync write and the idle check, so check-and-enqueue is atomic on the event loop (see `SaveStorage.saveForExit` in [save-storage.ts](./save-storage.ts), the owner of this ordering; `io.ts` delegates exit saves to that storage instance). Each snapshot serialization stamps its own `lastSavedAt`. `SaveStorage` advances that timestamp beyond its loaded save and prior serialized writes, even when the clock repeats or moves backward, so a newer recovery save cannot lose to an older primary on reload. Primary-to-recovery fallback retries reuse the same serialized payload and timestamp. Desktop IPC uses the same serialized coalescing queue and returns a promise for the actual write outcome. A failed synchronous exit remains retryable through the scheduler retry while mounted. Desktop shutdown remains best effort, so earlier visibility/pagehide signals give IPC time to finish before the window closes. Terminal saves supersede queued snapshots that have not started writing.

Renderer gameplay checkpoints publish Saving… before any completed result. Display
hooks retain pre-action progress while domain commands resolve and saving runs.
A successful primary or recovery write releases the pending result; failed and
skipped writes never acknowledge it. If both slots fail, progression pauses with
Couldn’t save and Retry. Retrying saves the committed snapshot without executing
the action again. Automatic retry remains with the existing scheduler and cooldown;
explicit Retry resets its submission latch without changing normal exit deduplication.

Checkpoint revisions, epochs, pending presentation references, and failure status
are runtime-only. Restoring another run, clear, write protection, and disposal
invalidate stale acknowledgements and completion feedback. No schema migration is
needed. Completed outcomes survive process interruption after local acknowledgement;
shutdown flushing of unfinished work remains best effort.

Cloud mirroring runs independently after local writing, serialized across both
slots with the newest queued payload per slot. A mirror failure cannot delay local
completion. Clear cancels queued mirrors and waits for an active upload before
Cloud deletion. Candidate selection, account ownership, and recovery policy retain
the existing contracts.

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

Candidate compatibility/freshness prefilter → supported migrations → current-shape validation and normalization → winner selection → active-run card hydration → codec hydration and restore. Version 19 Mystery offers migrate to version 20 before validation; below-floor and future formats never enter that transformation. `SaveDataSchema` is a load-tolerant shape validator; raw-version acceptance belongs to candidate evaluation and must occur first. Test-only direct parsing is not the compatibility gate. Repair happens in two layers with distinct owners: schema load-repair (`SaveDataSchema` transform) runs inside candidate evaluation, then codec hydrate-repair (`hydrateAlchemyPersistenceFields` in `storage/persistence.ts` plus the run-profile codec) runs at restore; after winner selection, `toActiveRunData` hydrates its run deck, draft choices, Card/Alchemist shop cards, Mystery cards, and Corruption pair. Battle piles hydrate later through `restoreActiveBattle`; candidate evaluation does not publish gameplay state.

## Implementation rules

- Card IDs that disappear from the live catalog are stripped against the live catalog at load in `normalize-active-run-data.ts`. Record deliberate removals in `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts` so fixtures stay explicit. The guard test in `save-migration-guard.test.ts` checks `discoveredCardIds` for catalog or tombstone membership; deck, shop, battle, mystery, and corruption piles rely on silent live-catalog stripping without a tombstone requirement.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. Filtering can leave an empty deck; the battle engine handles empty piles through Emergency Wish. No player-facing diagnostics.
- Card validation and hydration treat saved effects and descriptions as one content unit. `BattleCardSchema` returns an empty effect list if any effect fails validation, including nested effects; missing or malformed lists likewise become empty. `hydrateCard` preserves both saved lists only when both are usable, without comparing their lengths against the current catalog. Otherwise it restores both from the library and clears saved `corrupted`, `baseTitle`, and `corruptedValuePositions`. Valid saved cost, UID, and explicit Consume overrides survive; title, art, and catalog metadata refresh from the library. The empty-list recovery signal survives normalization and JSON round trips without extra saved fields.
- Cards may persist a structured `description` alongside the existing `descriptionLines`. Its literal parts, semantic line roles, stable magnitude identities, typed effect references, formatting, and corruption marks are data-only. Validation checks structure and actual effect kinds, numeric fields, nested paths, agreement across shared values, and identity consistency. Valid bindings regenerate cached text and highlight offsets, including after missing or stale caches; malformed bindings are discarded with a diagnostic while valid effects and text retain the existing recovery policy. Records without bindings still load as complete saved effects/text units; subsequent mutations derive canonical bindings from their effects, never by parsing saved prose. Current-format custom wording and Mixed Potion ingredient boundaries persist through the structured model. This is an optional additive field with safe reconstruction, so the schema version stays unchanged. Clone and hydrate deep-copy references and nested paths, and catalog metadata never overwrites a saved description model.
- The same card validator covers active-run card locations and saved battle deck, hand, discard, exhausted, Wish options, and Wish queue, in the committed battle activity. Battle card hydration occurs when `restoreActiveBattle` restores the session; other card locations hydrate through `toActiveRunData`. Complete valid saved modifications survive even when their effect count differs from current content. Incomplete content recovery may reset card modifications, but requires no schema bump because the persisted shape and valid values retain their meanings.
- Card arrays keep valid entries when a sibling card is malformed, with a developer-facing repair warning for each dropped position. Missing or non-array run decks still invalidate the run. Shop and Alchemist purchase keys follow surviving cards to their new slots. A Wish prompt emptied by malformed or removed cards advances to the next nonempty queued choice, or closes when none remains, so resumed combat stays playable.
- Battle normalization repairs invalid Mana to zero and enforces the current minimum of one Mana Crystal. Valid unspent Mana and overflow above the crystal count survive resume.
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

## Display preferences

Screen Effects and Drifting Lights were removed before the supported release
baseline. Their renderers, defaults, codec fields, and schema fields are removed
together. Existing snapshots retain ordinary settings and permanent progress;
unknown removed preference fields are discarded by the save schema. Game Size
and Tooltip Size remain device preferences despite sharing the Display tab.

## Shared run-progress shape

`lib/validation/save-schemas/run-progress.ts` owns progression schema fields and legacy recovery defaults. `PersistedRunProgress` and `ACTIVE_RUN_PROGRESS_KEYS` derive from it; `ActiveRunData` extends the shared wire fields and `ActiveRunProgressFields` narrows destination names for live state. Saved callers remain permissive about historical destination names until normalization. Fresh-run constructors still own starting decks, seeded RNG, fresh collection instances and zero earned totals. Legacy missing `runHistoryPartial`/`runGoldEarned` still recover as `true`/`null`; never replace those with fresh-run defaults. New progress fields require their schema and meaningful fresh/resume initialization, without a duplicate wire/live declaration or key-list edit.

## Demo account identity and transfer

`steamAccountId` is a nullable additive envelope field, defaulting to null. Native
Steam writes stamp the current account for matching local demo sources. Permanent
progress import, separate cloud filenames and initialization receipts are owned
by [Steam demo](../../../../../Docs/STEAM_DEMO.md). Receipts survive Clear Save Data;
no active run or full-Campaign win credit is imported. Public demo carryover freezes
the supported baseline just like a full release; never retire promised progress.

## Alchemy visit and reaction additions

Current saves include optional Campfire/Transmutation visit records with fixed offers, original/result cards, and completion. Missing records default to null and initialize on first entry; existing records survive resume without rerolling or repeated grants. Saved cards retain optional `brewed` metadata so transformations remain ineligible after hydration.

Battle flags include `shatterUsed` and `wildfireUsed`, defaulting to false through the canonical flag definitions and resetting each player turn. Current snapshots preserve spent opportunities across reload. These compatible additive defaults do not require a schema-version bump.
