# Save compatibility and storage

This document owns format acceptance, current-data recovery, file/Cloud transport
and deletion. [Run state](../../../../../Docs/RUN_STATE.md#persistence-api) owns
session snapshots, codecs and completion; [run workflows](../../../../../Docs/RUN_WORKFLOWS.md)
own editing sequences.

## Public save contract

Local storage is authoritative; Cloud is a mirror. Choose playable candidates by freshness, and route writes around unreadable or newer-format data when a permitted slot is available, subject to the both-slots exception below. A save submission succeeds only when local storage accepts its own snapshot. A submission replaced before writing returns `superseded`; replacement success does not change that result. Completed gameplay actions wait for a local write whose session receipt covers their revision under [write acknowledgement](#write-acknowledgement). Deletion has explicit modes; pending writes must not resurrect deleted data. Load problems fall back to playable data or defaults without a recovery-choice screen.

Read the applicable contract before changing its behavior:

- [Loading and candidate selection](#load-selection), including [load order](#load-order).
- [Compatibility and future protection](#future-schema-saves), plus [when to increment](#when-to-increment).
- [Write acknowledgement and autosave](#write-acknowledgement).
- [Deletion modes](#deletion).
- [Local/Cloud policy](#policy-local-is-authoritative) and [content repair rules](#implementation-rules).

## Compatibility

### Supported baseline

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

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the minimum supported format. Development formats below the floor are disposable; `evaluateSaveCandidates` rejects them before permissive field validation can stamp defaults. If no supported or protecting future candidate remains, load defaults without explicitly clearing backup or Cloud sources. A retired-format payload can be replaced by the next normal save; new progress is routed away from a newer-format payload when another slot is available. Do not salvage old profiles or parked runs.

Game build identity is distinct from schema and content versions. Ordinary compatible builds do not reset saves. Freeze the supported floor at the first distribution whose progress is promised to persist, including a playtest or Early Access release. Preserve subsequent supported formats. Version sources are split: the build version is generated from `package.json` by `scripts/sync-version-metadata.mjs`, while schema and content versions are hardcoded in `src/lib/validation/metadata.ts`.

### When to increment

Increment the schema version for structural or meaning changes that require a supported payload transformation. Do not bump for safe additive defaults. Content versions are reserved for content ID/meaning remaps, not ordinary balance tuning. `save-versions.ts` owns one compatibility classification (supported, retired, newer schema, or newer content) plus timestamp ordering. Schema protection takes precedence over content protection; both precede retired-format rejection. There is no migration pipeline while the supported floor equals the current schema. Add transformations only when supported formats diverge.

### Saved card definition revisions

`BattleCard.definitionVersion` is optional metadata for identifiable card-rule
normalization within the current save format; absence means revision 0. It does
not raise the schema floor. Ordinary numerical tuning does not advance it.

[`normalizeSavedCardDefinition`](../../../../../src/lib/game-data/cards/normalize-saved-definition.ts)
runs during hydration for saved cards, including restored battle piles. It updates
identifiable Shield Bash and Elusive rules and their matching wording without
replacing other valid modifications or reinterpreting queued committed effects.
Leave an ambiguous rule unchanged; do not guess or claim it migrated.
An already-armed guaranteed Dodge remains valid independently of the Elusive card
normalization. Restore must preserve battle state and RNG without replaying actions.
The [normalization](../../../../../tests/lib/game-data/normalize-saved-definition.test.ts),
[Shield Bash resume](../../../../../tests/features/alchemy/shared/stores/persistence/shield-bash-definition-resume.test.ts),
and [Elusive resume](../../../../../tests/features/alchemy/shared/stores/persistence/elusive-resume.test.ts)
tests cover these cases.

### Schema change contract

Choose a safe additive default or a transformation under [When to increment](#when-to-increment).
Never advance the supported floor casually. When supported formats diverge,
ordered transformations must cover every increment and run before current-shape
validation; retain previous-version fixtures in `tests/fixtures/current-saves.ts`.

Schema, owning codec, domain defaults and fixtures change together. Run-profile
fields also update `RUN_PROFILE_SAVE_KEYS`; its compile-time completeness check
covers every `PermanentProgressFields` member. Other domains retain their own
codec selections. [Shared run-progress shape](#shared-run-progress-shape) owns the
active-run projection. Every supported increment needs assertions preserving
playable progression, not just fields;
Gear/currency assertions live in the `gear-save` / `save-data-schema` suites.

Follow [the editing workflow](../../../../../Docs/RUN_WORKFLOWS.md#change-persisted-save-data)
for implementation and verification.

### Test expectations

Current saves must round-trip valid profile progress, inventories/loadouts, current-run geography, deck modifications, each activity branch, choices, and committed battle results/RNG. Test malformed current fields, an invalid run alongside a valid profile, stale autosaves after run end, and future-candidate precedence. `save-migration-guard.test.ts` covers baseline rejection and current recovery.

Current-data cases follow [recovery rules](#current-data-recovery). Use them to
select consequential assertions; existing fixtures and shared validators remain
the starting point rather than adding one test per field.

### Shared run-progress shape

`lib/active-run-session/run-progress.ts` owns `PersistedRunProgress` and its exhaustive `ACTIVE_RUN_PROGRESS_KEYS` projection. `ActiveRunData` extends those shared fields; `ActiveRunProgressFields` narrows destination names for live state. Saved callers remain permissive about historical destination names until normalization. The save schema in `lib/validation/save-schemas/run-progress.ts` checks every field against that contract and owns recovery defaults. Fresh-run constructors still own starting decks, seeded RNG, fresh collection instances and zero earned totals. Missing `runHistoryPartial`/`runGoldEarned` still recover as `true`/`null`; never replace those with fresh-run defaults. New fields require the domain contract, exhaustive projection, schema and meaningful fresh/resume initialization.

`lib/validation` owns `parseActiveRun`, `toActiveRunData` and conversion of parsed Mystery choices into domain effects. Session contracts, activity helpers and live constructors never import validation. `PersistedPendingReward` belongs beside the domain reward types; its save schema checks that output contract.

## Recovery

### Defaults and resume normalization

`createDefaultSaveData()` in `storage/defaults.ts` clones a frozen schema-derived
singleton for each caller. The save contract test protects cross-load isolation.
Update the affected defaults and fixtures together:

| Domain             | Default owner                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Settings           | `SettingsSaveFieldsSchema` and `createDefaultSettingsSaveFields` in `src/lib/validation/save-schemas/settings.ts` |
| Profile            | `createDefaultProfileSaveFields` in `shared/stores/session/profile-store-types.ts`                                |
| Gear               | `createInitialGearState` in `shared/stores/session/gear-state-defaults.ts`                                        |
| Permanent progress | `createInitialPermanentFields` in `shared/stores/session/run-state-init.ts`                                       |
| Fixtures           | `tests/fixtures/saves.ts` (campaign-full) and `tests/helpers/save-candidate-fixtures.ts` (candidate-minimal)      |

Repair runs in two stages:

1. **Schema load repair:** `SaveDataSchema` in `save-data.ts` applies live-combat
   Gold override, autoplay derivation and orphan-loadout pruning. Valid finite,
   nonnegative combat Gold overrides purse Gold without a repair warning.
2. **Codec hydration:** `hydrateGameplayPersistenceFields` in
   `persistence/persistence-hydration.ts` prunes unknown Companions, recomputes
   Homestead effects and unions Unique ownership. Complete-save restore composes
   this operation in its existing transaction; `hydrateAlchemyPersistenceFields`
   is the separate fields-only wrapper.

Validation supplies safe current-field defaults; normalization repairs choices
and catalog references; hydration restores runtime cards and manifests. Preserve
valid modifications, Health, defenses, flags, choices and RNG. Never replay
starting grants or actions. Retired crystal/recovery and historical Talent
conversions are not aliases for current fields.

#### Current-data recovery

Repair fields independently where possible: keep valid sibling entries, choices,
combat state and RNG; do not discard a usable card for damaged optional metadata.
Keep numeric progress safely usable. Refresh catalog-owned identity and native enemy
Traits without admitting unsupported encounter Traits. The schema and
[active-run normalization](../../../../../src/lib/validation/normalize-active-run-data.ts)
own individual defaults and repairs; [battle recovery tests](../../../../../tests/lib/validation/battle-recovery-gameplay.test.ts)
exercise their gameplay consequences.

Only the selected candidate may request abandonment of a nonterminal snapshot
marked as an enemy turn; the current engine cannot resume an intermediate enemy
phase. Restore settles abandonment atomically and queues the terminal snapshot;
stale bootstrap results cannot abandon an initialized run. Terminal committed battles remain resumable. Unusable
selected activity structure drops only the run, preserving permanent progress and
future-save protection. Invalid battle Gold falls back to purse Gold in both places;
valid zero remains authoritative. Recovery must not replay actions or grants.

Repair missing offers only where the selected activity needs them, using its saved
RNG stream; retain spent services and completed choices. Remap surviving shop and
Transmutation indices when damaged cards are removed so purchases stay spent and
selections cannot point to another card. [Activity repair](../../../../../tests/lib/validation/normalize-repair.test.ts)
and [run restore](../../../../../src/features/alchemy/shared/stores/persistence/run-restore.ts)
own the specific cases.

### Load order

Candidate compatibility/freshness prefilter → current-shape validation and normalization → winner selection → active-run card hydration → codec hydration and restore. Below-floor and future formats never enter current-shape validation. `SaveDataSchema` is a load-tolerant shape validator; raw-version acceptance belongs to candidate evaluation and must occur first. Test-only direct parsing is not the compatibility gate. Repair follows the owners in [defaults and resume normalization](#defaults-and-resume-normalization); after winner selection, `toActiveRunData` hydrates its run deck, draft choices, Card/Alchemist shop cards, Mystery cards, Corruption pair, and Campfire/Transmutation cards. Battle piles hydrate later through `restoreActiveBattle`; candidate evaluation does not publish gameplay state.

### Battle decoding and semantic repair

The wire schema validates structure and scheduled/card collections before semantic
repair. `DecodedPersistedBattle` deliberately leaves enemy identity, status,
reaction and flag records untrusted; normalization validates those records and
then repairs resources, pile identities, and cross-field survival relationships.
Optional card metadata is omitted when absent, matching the runtime card type.
Serialized reward/destination payloads remain owned by their codecs.

### Implementation rules

- Strip card IDs absent from the live catalog. Record deliberate removals in
  `TOMBSTONED_CARD_IDS` for the discovery guard; filtering may leave an empty deck,
  which combat handles through Emergency Wish.
- Treat saved effects and descriptions as one unit. Preserve complete valid
  modifications, even when they differ from the catalog. If either is unusable,
  restore both from the library and clear `corrupted` and `baseTitle`; preserve
  valid cost, UID and explicit Consume overrides. Catalog-owned title, art and
  metadata refresh. [Card hydration](../../../../../src/lib/game-data/cards/hydrate-card.ts)
  and the [card schema](../../../../../src/lib/validation/save-schemas/battle-card-schemas.ts)
  own exact validation and recovery.
- Preserve valid structured description bindings, custom wording, Mixed Potion
  boundaries and Corruption/Distill marks. Invalid bindings are discarded with a
  diagnostic, not used to replace valid mechanics. Localization messages and
  character offsets are derived, not saved; see [card descriptions](../../../../../Docs/CONTENT_AUTHORING.md#card-descriptions).
- Apply the same card rules to run locations and battle piles. Retain valid array
  entries when siblings are malformed, repair purchase indices, and advance past
  empty Wish choices. A missing or non-array run deck still invalidates the run.
- Repair battle state field by field; keep valid Mana, including zero and overflow.
  Load statuses and repair warnings are internal diagnostics and do not open a
  recovery-choice screen.

### Current field recovery

Recovery defaults may differ from fresh-run defaults. The schemas and tests own
individual fields; preserve these cross-field invariants when changing them:

- **Progression:** Rebuild derived Talent and Homestead manifests from purchased IDs and resolve
  Unique affixes from the current catalog. Keep valid purchased progress, combat flags,
  pending effects, RNG and resolved grants; never reapply starting grants or
  Homestead refunds during hydration. Preserve the starter Homestead grant receipt
  so a load or reset cannot award it twice. Missing or malformed receipts recover
  from existing Homestead purchases. [Save schema](../../../../../src/lib/validation/save-schemas/save-data.ts)
  and [schema tests](../../../../../tests/lib/validation/save-data-schema.test.ts)
  own its missing-field recovery.
- **Combat:** Preserve spent per-turn allowances, until-consumed readiness and
  reaction progress; do not infer them from current statuses. Preserve attributed
  pending Bleed Leech and valid Returning Flight discounts; repair invalid
  cross-field relationships and drop invalid or ambiguous card references without
  discarding valid siblings. A battle without a known enemy or any card-pile array
  cannot be fabricated; drop combat and report repair while keeping the run playable.
  [Battle normalization](../../../../../src/lib/validation/normalize-persisted-battle-state.ts)
  and [gameplay recovery tests](../../../../../tests/lib/validation/battle-recovery-gameplay.test.ts)
  own the individual rules.
- **Recap:** Missing or damaged run history remains partial; missing earned Gold
  is unknown (`null`), not zero or inferred from the purse. Do not replay visits
  or earnings on load. [Recap ownership](../../../../../Docs/RUN_STATE.md#run-recap-ownership)
  governs the ending snapshot.

#### Alchemy visits and modified cards

Campfire and Transmutation are tagged `activeRun.activity` branches. Persist
fixed offers, original/result cards, selections and completion together; resume
without rerolling initialized offers or repeating grants. Alchemist Brew, Mix and
Distill usage is independent and survives reload. An unused Brew service with no
surviving offers may regenerate from the saved shops stream; a spent service does
not draw RNG. Recovery must preserve modified effects, descriptions and marks
together, and remap Transmutation source indices after deck repair; clear a
selection whose source was lost. Prismatic Crucible may select any compatible
keyword, including beyond the normal three offers. Completed Transmutation follows the [interaction contract](../../../../../Docs/UI_BROWSING.md#campfire-and-transmutation).
[Active-run normalization](../../../../../src/lib/validation/normalize-active-run-data.ts)
and [repair tests](../../../../../tests/lib/validation/normalize-repair.test.ts) own
individual offer and selection cases.

Localized description messages and character offsets are derived rather than saved;
the device-local language preference is outside the progress envelope and Steam
Cloud. See [Localization](../../../../../Docs/LOCALIZATION.md).

## Storage transport

### Policy: local is authoritative

Steam Cloud is a one-way mirror. Both the primary (`save.json`) and recovery (`save-recovery.json`) slots write local-first, atomically with their own `bak.1-3` ring and `tmp` in `desktop/save-storage.cjs`, then mirror to the matching Cloud filename. Browser storage uses the primary `alchemy-save-v1` and recovery `alchemy-save-recovery-v1` keys.

Device display preferences (versioned `alchemy-device-display-v<n>` key, currently v1) stay outside the versioned save: they survive save wipes, are never cloud-mirrored, and never gate loads. A version mismatch resets them to defaults silently (no error-sink entry); only unreadable storage or corrupt JSON is logged.

### Load selection

`readDesktopCandidates` in `src/lib/platform-save-backend.ts` collects each slot in preference order (local ring → Cloud). The local ring read order lives in `desktop/save-storage.cjs`; the backend appends the matching Cloud mirror and deduplicates identical payloads. The storage owner evaluates primary candidates before recovery candidates, and the freshest playable candidate that Zod-validates wins by `lastSavedAt`; corrupt candidates fall through to another source. Evaluation is deterministic in `src/features/alchemy/shared/storage/save-candidates.ts#evaluateSaveCandidates`. Recovery diagnostics are logged at the I/O seam, and only the winning candidate is hydrated against the live catalog.

Routine skips stay silent: missing, empty, and below-baseline candidates on fresh profiles never reach the error sink (`logStorageFailure`), because browser journeys assert zero runtime errors. Non-object roots and genuinely corrupt JSON do report. Candidate validation reports genuinely corrupt JSON and schema failures of otherwise versioned candidates; storage I/O failures are logged separately. Pinned by `save-version-protection.test.ts`.

`selectSaveCandidates(primary, recovery)` inspects each candidate once and returns
the load state together with the ordered write slots permitted by compatibility. Compatibility
checks inspect every newer-format candidate, including stale copies after the
playable winner. Slot protection follows the both-slots exception below. The winning raw payload, validated data, and repair notes stay
together until hydration. `evaluateSaveCandidates` is the single-source facade;
demo import uses the same selection and rejects a protected source. Storage adds
unreadable-primary protection at the I/O boundary. Ordinary saves, synchronous
exit saves, and explicit recovery routing use the same permitted slots; a
fallback cannot bypass the compatibility decision.

A failed local candidate read is different from an empty or corrupt candidate set. Desktop still attempts the Cloud copy; the storage owner tries both slots and uses any compatible candidate it can read. If the primary is unreadable, new progress writes to the recovery slot, leaving the primary untouched, unless recovery is known to contain newer-format data. In that case, neither slot is writable and saves report failure. If neither slot can be read, play starts with defaults and writes still attempt the recovery slot. If a normal primary write fails, the same snapshot is attempted in recovery only when that slot is permitted. When all permitted writes fail, committed progress remains in memory and autosave keeps retrying, while the renderer holds action completion and shows Couldn’t save with Retry under [write acknowledgement](#write-acknowledgement).

Unreadable Cloud files (including a present file returning no bytes or exceeding
the native payload limit) protect their slot just like unreadable local files.
An unreadable recovery slot is excluded from fallback writes when primary reads
succeeded; a protected primary plus unreadable recovery leaves no writable slot.
When both sources are unreadable, the existing last-resort recovery policy applies.
Native reads, writes, and clears share one process queue across renderer lifetimes.
Shutdown closes write admission and drains accepted operations before quitting.
Owner stamping is included in the payload size limit before either disk or Cloud
accepts a write. Demo initialization receipt writes also serialize so concurrent
initialization and Clear Save requests cannot race their shared temporary file.

### Future schema saves

Saves with a schema or content version newer than the current build are intentionally not migrated. Any playable candidate wins over a newer-format candidate, even when the newer copy has a later timestamp, so a compatible backup or recovery copy can still resume play. If no playable candidate exists, load defaults. The storage owner routes writes away from a slot holding newer-format data when another slot is available.

When only one slot holds newer-format candidates, new saves use the other slot if it is readable and otherwise permitted; otherwise they fail without overwriting the protected slot. If both slots hold incompatible data, the recovery ring remains the best available write target; older recovery backups can eventually rotate out. A later build evaluates both slots again and selects the freshest playable candidate. No player-facing save decision is required.

Tie rules: playable-vs-playable ties keep the first candidate in read order — primary local ring, primary Cloud, recovery local ring, then recovery Cloud. Future-vs-future ties likewise keep the first candidate in read order for internal diagnostics. Fractional `lastSavedAt` values floor before comparison; missing timestamps fall back per domain (`-1` for future, `0` for the playable pre-filter matching the schema default) via `getCandidateSavedAt`.

### Demo account identity and transfer

`steamAccountId` is a nullable additive envelope field, defaulting to null. Native
Steam writes stamp the current account. Native local progress and initialization
receipts live below the edition's userData directory in `steam/<SteamID64>/`, or
`offline/` when Steam identity is unavailable. Isolated test/playtest profiles
retain their supplied directory and never use live Steam. The Electron browser
profile remains edition/device-local, preserving language and display preferences.

One-time legacy migration copies only candidates whose stamped account matches
the selected account; unowned candidates belong only to offline play. Originals
remain intact, established target profiles are never supplemented, and the local
`legacy-migration.json` receipt survives Clear Save Data to prevent resurrection.
Clear must retain that receipt before deleting snapshots, even when a startup
migration copied data but failed to retain its receipt. Receipt failure prevents
deletion and leaves the existing progress intact.
Local demo transfer checks the matching account directory and the preserved
legacy demo directory, accepting only matching owner stamps. No renderer-supplied
path can select another account.

Permanent
progress import, separate cloud filenames and initialization receipts are owned
by [Steam demo](../../../../../Docs/STEAM_DEMO.md). Receipts survive Clear Save Data;
no active run or full-Campaign win credit is imported. Public demo carryover freezes
the supported baseline just like a full release; never retire promised progress.

### Write acknowledgement

#### Submission outcomes

Normal saves and explicit flushes return these outcomes:

| Result       | Meaning                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saved`      | Local storage accepted this snapshot in the active slot; Cloud failure remains non-fatal                                                           |
| `superseded` | Coalescing replaced the pending submission; replacement success cannot acknowledge its discarded payload, and autosave retains unacknowledged work |
| `skipped`    | Cancelled, protected, or storage unavailable                                                                                                       |
| `failed`     | Serialization/backend failure or no permitted write slot; retain the retry gate and log failures at the I/O seam                                   |

A failed primary write tries a permitted recovery slot with the same serialized
payload and timestamp. Only a current covering local write acknowledges an action.
Runtime checkpoints, epochs, retry drivers and deferred feedback follow
[session completion](../../../../../Docs/RUN_STATE.md#completed-actions-and-local-saving);
[UI feedback](../../../../../Docs/UI.md#pending-saves-and-action-feedback) owns Saving/Retry.
Completion and scheduling metadata are never saved. Acknowledged outcomes survive
process interruption; submission of unfinished renderer work at shutdown is best effort.

#### Operation ordering

| Owner                             | Serialized work                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each storage instance             | Loads, writes and clears; loads observe preceding writes and establish permitted slots before following saves; coalescing cannot cross a load barrier |
| `platform-save-backend.ts`        | Local reads/writes/deletion and demo receipts across adapters sharing an IPC endpoint                                                                 |
| `desktop/save-storage.cjs`        | File rings and demo initialization receipts across both slots and renderer reloads                                                                    |
| `desktop/steam-cloud-storage.cjs` | Cloud reads/uploads/deletion across renderer replacement                                                                                              |

Failure releases each lane; failed loads reject their caller without blocking later
work. Writes cannot overtake deletion. Demo import, its local write and initialization
receipt belong to one load operation; a following clear waits, then deletes the import.
Native disk, Cloud and receipt lanes share `desktop/serial-operations.cjs` while
remaining independent queues. `desktop/save-profile.cjs` owns the local ring paths:
temporary files protect an established profile and are cleared, but are not read
as save or demo-import candidates.
Draining and backend replacement account for all queued operations, including loads,
initialization writes, failure notifications and progress receipts from immediate
saves with no awaiting caller. Loads and successful clears resume writes only when
no newer explicit permission decision intervened; selecting recovery grants no permission.
An explicit recovery route survives later loads, subject to protected-slot checks,
until a successful clear or backend replacement. Failed demo-source reads and
import writes remain retryable on a later load and do not consume the import receipt.

Clear follows the session's [completion lifecycle](../../../../../Docs/RUN_STATE.md#completion-lifecycle):
snapshots are revoked immediately, pending progress survives failure, and overlapping
clears share one pause. [Deletion](#deletion) owns backend order and modes.

Native shutdown closes admission at `will-quit`, after unload handlers can submit
final snapshots, and drains accepted writes. Quitting resumes on the next event-loop
turn after Electron resets its cancelled-quit state, even if the queue was already idle.

#### Autosave and exit

Autosave retains unacknowledged work; older completions cannot clear newer revisions.
[The scheduler](../../../../../src/app/autosave-scheduler.ts) owns timing;
[the lifecycle](../../../../../src/app/autosave-lifecycle.ts) supplies debounce selection,
snapshots, completion gating and subscriptions for React/headless callers. The React
hook adds browser lifecycle listeners.

- Snapshot/write failure retries through one timer no sooner than
  `AUTOSAVE_RETRY_COOLDOWN_MS`, even with disabled animations or new changes.
  [Storage constants](../../../../../src/lib/game-constants/storage.ts) keep retry
  backoff independent of shrunken debounces and separately tunable from maximum wait.
- Exit may bypass cooldown, with one submission per revision across repeated exit
  signals. Terminal saves supersede queued snapshots that have not started writing.
- Clear pauses scheduling. Successful deletion or write protection invalidates pending
  acknowledgement and cancels scheduling; disabled persistence and hook cleanup stop
  retries. Late timers/completions cannot restart cancelled work or flush a disposed lifecycle.

Browser `visibilitychange`, `pagehide` and `beforeunload` synchronously flush the
latest unacknowledged snapshot through `writeSync`. In
[`SaveStorage.saveForExit`](./save-storage.ts), the write and idle check contain no
intervening await. An idle successful write returns `saved`. If an older write may
still land, the latest snapshot also replaces pending work and completion waits for
that final queued write.
A failed sync exit remains retryable while mounted. Desktop IPC returns the actual
queued outcome. Earlier visibility/pagehide signals allow more time to submit
unfinished renderer work before native shutdown closes admission.

Exit saves wait behind pending loads without sync writing because slot protection
is unknown, and skip during clear. The sync path resumes after those barriers.
Each serialized snapshot gets a `lastSavedAt` later than the loaded save and prior
serialized writes, even if the clock repeats or reverses, preserving recovery freshness.
`io.ts` delegates exit ordering to the same storage instance.

#### Cloud mirroring

Mirroring follows local writing independently, serialized across both slots with
only the newest queued payload per slot. Failure cannot delay local acknowledgement.
Clear suspends queued mirrors and waits for active uploads before Cloud deletion,
including uploads admitted by a departed renderer. A successful clear discards the
suspended writes; if every overlapping clear fails, the newest queued writes resume.
Following reads observe deletion; failures release the lane. Account and recovery policies remain unchanged. Native operations check both
Steam account/app Cloud settings at execution time; disabled Cloud reads yield
no candidate and writes/deletions leave its cache untouched.

## Deletion

Deletion mode is explicit (`"default"` | `"localWipe"`), not inferred from the visible screen.
Cloud deletion applies only while both Steam Cloud preferences are enabled;
disabled Cloud leaves its cache untouched and clears only the local profile.

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
