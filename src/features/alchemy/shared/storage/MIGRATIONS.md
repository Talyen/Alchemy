# Save compatibility and storage

Canonical owner for save compatibility, load recovery, write acknowledgement,
and deletion. Start with the [public save contract](#public-save-contract) for
storage behavior or the [required pattern](#required-pattern-automated) for a
schema change. [Run and save workflows](../../../../../Docs/RUN_WORKFLOWS.md)
cover implementation steps; gameplay tuning belongs to the linked rule owners.

## Public save contract

Local storage is authoritative; Cloud is a mirror. Choose playable candidates by freshness, and preserve unreadable or newer-format data in its existing slot while current play writes a safe slot. A save submission succeeds only when local storage accepts its own snapshot. A submission replaced before writing returns `superseded`; replacement success does not change that result. Completed gameplay actions wait for a local write whose session receipt covers their revision under [write acknowledgement](#write-acknowledgement). Deletion has explicit modes; pending writes must not resurrect deleted data. Load problems fall back to playable data or defaults without a recovery-choice screen.

Read the applicable contract before changing its behavior:

- [Loading and candidate selection](#load-selection), including [load order](#load-order).
- [Compatibility and future protection](#future-schema-saves), plus [when to increment](#when-to-increment).
- [Write acknowledgement and autosave](#write-acknowledgement).
- [Deletion modes](#deletion).
- [Local/Cloud policy](#policy-local-is-authoritative) and [content repair rules](#implementation-rules).

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

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the minimum supported format. Version 21 is the current development baseline and stores one tagged run activity plus resolved Mystery offers. The retired version 19 and 20 formats are not migrated. Development formats below the floor are disposable. `evaluateSaveCandidates` rejects those candidates before permissive field validation can stamp defaults. If no supported or protecting future candidate remains, load defaults without explicitly clearing backup or Cloud sources. A retired-format payload can be replaced by the next normal save; new progress is routed away from a newer-format payload when another slot is available. Do not salvage old profiles or parked runs.

Game build identity is distinct from schema and content versions. Ordinary compatible builds do not reset saves. Freeze the supported floor at the first distribution whose progress is promised to persist, including a playtest or Early Access release. Preserve subsequent supported formats. Version sources are split: the build version is generated from `package.json` by `scripts/sync-version-metadata.mjs`, while schema and content versions are hardcoded in `src/lib/validation/metadata.ts`.

## When to increment

Increment the schema version for structural or meaning changes that require a supported payload transformation. Do not bump for safe additive defaults. Content versions are reserved for content ID/meaning remaps, not ordinary balance tuning. `save-versions.ts` owns one compatibility classification (supported, retired, newer schema, or newer content) plus timestamp ordering. Schema protection takes precedence over content protection; both precede retired-format rejection. There is no migration pipeline while the supported floor equals the current schema. Add transformations only when supported formats diverge.

## Required pattern (automated)

1. Decide whether a compatible default or supported transformation is required.
2. Change version metadata only as required; never advance the supported floor casually.
3. For a supported transformation, (re)introduce an ordered migration table covering every increment and apply it before current-shape validation. Update schema and hydration defaults together.
4. Change the save shape, its owning codec, defaults, and fixtures together. For run-profile fields, also update `RUN_PROFILE_SAVE_KEYS`: this explicit tuple has a compile-time completeness check, so adding a `PermanentProgressFields` member fails the build until that key list is updated. Other domains keep their own codec field selections.
5. Add previous-version fixtures to `tests/fixtures/current-saves.ts` when supported versions diverge. Preserve playable state and progression, not just field presence. The save contract tests pin the development baseline and current defaults; add coverage for every supported increment when migrations become necessary. Gear/currency coverage lives in the `gear-save` / `save-data-schema` suites.
6. Run relevant save/persistence units with `npm run test:unit -- <test-paths>` and
   the [task gate](../../../../../CONTRIBUTING.md#what-to-run-when-you-change), which
   selects save protection for persisted-state owners. Use `--plan` to inspect scope.

## Test expectations

Current saves must round-trip valid profile progress, inventories/loadouts, current-run geography, deck modifications, each activity branch, choices, and committed battle results/RNG. Test malformed current fields, an invalid run alongside a valid profile, stale autosaves after run end, and future-candidate precedence. Historical below-baseline tests are retired; `save-migration-guard.test.ts` covers baseline rejection and current recovery.

Current-data cases follow [recovery rules](#current-data-recovery). Use them to
select consequential assertions; existing fixtures and shared validators remain
the starting point rather than adding one test per field.

## Discarded presentation fields

Current-shape normalization drops obsolete board ownership, selection, resolved
background and pending-reward fields, plus `selectedAspectRatio`. They are absent
from new writes; the game fills the viewport. Preserve all other valid profile and
active-run data. These removals require no schema bump or supported transformation.

## Progression gate fields

Choose the intended new-player default. Safe additive fields retain that default and valid saved values; transformations of supported progress require versioned evidence and gameplay assertions. Current authoring validation remains strict and separate from load-tolerant recovery.

## Content changes without a save bump

Catalog tuning and compatible defaults do not require a schema bump. Derived
Talent and Homestead manifests rebuild from purchased IDs; Unique affixes resolve
from the current catalog. Preserve valid modified card effects, descriptions,
explicit Consume overrides, identities and pile membership together. Incomplete
card content follows [current-data repair](#implementation-rules).

Retired mechanics and undeclared manifest/flag keys are discarded under the
[supported baseline](#supported-baseline), without historical aliases or parallel
combat rules. Battle defaults repair fields individually. Native enemy identity
and Traits refresh from the live catalog. A saved battle requires a known enemy
and at least one card-pile array, even when empty; otherwise drop combat and report
repair rather than fabricating a fight. The run remains playable.

Current combat flags retain their declared boolean or finite nonnegative numeric
values and lifetimes from [combat-flags.ts](../../../../../src/lib/battle/combat-flags.ts).
Preserve spent per-turn allowances and until-consumed readiness; never infer them
from current statuses or replay grants. Missing fields use their declared defaults.

Reaction progress is saved separately from turn flags. Preserve earned amounts,
spent CC opportunities, unmatched Wildfire ticks and Consecration marks. Missing
progress starts empty; invalid scalars repair independently. Clear CC rewards
outside active control and Consecration without Bleed; never reconstruct them from
current buildup. Phase-local Bloodboil/Venomflash facts add no saved counters.
`pendingCardBleedLeechHealing` defaults to zero and cannot exceed total queued Leech;
it retains card attribution for Clean Slate, independently of Deep Siphon's eligibility.

Summon hydration removes hidden Consume only when no explicit Consume description
exists; an explicitly added keyword remains a valid card modification. New battles
use current constructors. Gameplay meanings remain with
[Game rules](../../../../../Docs/GAME_RULES.md),
[Talent rules](../../../../../Docs/TALENT_RULES.md), and
[Armory](../../../../../Docs/ARMORY.md).

## Run recap tracking

Active runs add `runHistory`, `runHistoryPartial`, and nullable `runGoldEarned` with
safe additive defaults; no schema bump is required. New runs start with empty complete
history and zero earned Gold. Older runs default to empty partial history and unknown
Gold (`null`): subsequent visits are recorded with an omitted-history marker, while
Gold remains unknown until a fresh run. Never infer missing earnings from the purse.
History and earnings round-trip without recording visits or replaying earnings on
load. [Recap ownership](../../../../../Docs/RUN_STATE.md#run-recap-ownership) governs
the transient ending snapshot.

## Defaults and resume normalization

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

### Current-data recovery

Battle difficulty modifiers are validated individually during load. Keep valid
entries and drop malformed ones so the next enemy turn can resolve safely.
Profile and run XP retain only current keyword IDs; unknown entries cannot
contribute Talent points or starting Health.
Unsafe numeric XP entries are dropped independently so valid sibling progress
survives. Save timestamps use the same safe-integer policy for raw candidate
ordering and parsed freshness. Crafting currencies must remain safely spendable.
Damaged card UIDs, titles, and artwork do not remove otherwise usable cards;
identity repair and catalog hydration restore them. Scheduled battle pulses
retain the card effect schema's one-to-ten-turn duration limit.
Saved enemies regain their current native Traits from the catalog and retain
only current combat encounter Traits. Reward benefits stay in their separate
field; unsupported saved Traits cannot enter combat.

[Activity and committed playback](../../../../../Docs/RUN_STATE.md#committed-battle-playback)
own the single tagged activity and commit-before-animation model.
Only the selected candidate may request abandonment of a nonterminal snapshot
marked as an enemy turn;
the current engine cannot commit a resumable intermediate enemy phase.
Restore uses current abandonment settlement atomically, then queues the terminal
snapshot; stale bootstrap results cannot abandon an initialized run. Terminal
committed battles remain resumable. Unusable selected activity structure drops
only the run; permanent progress and future-save protection remain intact.
A damaged Mystery offer retains its tag with null data so restore can exit that
visit through the existing repair operation.
An unfinished Campfire with no usable Potion offer rebuilds its standard offers
once using the saved events stream. A resumed Labyrinth map clears stale pending
room locks. Invalid or missing battle Gold falls back to valid purse Gold in both
the battle and profile; a valid zero balance remains authoritative.

## Policy: local is authoritative

Steam Cloud is a one-way mirror. Both the primary (`save.json`) and recovery (`save-recovery.json`) slots write local-first, atomically with their own `bak.1-3` ring and `tmp` in `desktop/save-storage.cjs`, then mirror to the matching Cloud filename. Browser storage uses the primary `alchemy-save-v1` and recovery `alchemy-save-recovery-v1` keys.

Device display preferences (versioned `alchemy-device-display-v<n>` key, currently v1) stay outside the versioned save: they survive save wipes, are never cloud-mirrored, and never gate loads. A version mismatch resets them to defaults silently (no error-sink entry); only unreadable storage or corrupt JSON is logged.

## Load selection

`readDesktopCandidates` in `src/lib/platform-save-backend.ts` collects each slot in preference order (local ring → Cloud). The local ring read order lives in `desktop/save-storage.cjs`; the backend appends the matching Cloud mirror and deduplicates identical payloads. The storage owner evaluates primary candidates before recovery candidates, and the freshest playable candidate that Zod-validates wins by `lastSavedAt`; corrupt candidates fall through to another source. Evaluation is deterministic in `src/features/alchemy/shared/storage/save-candidates.ts#evaluateSaveCandidates`. Recovery diagnostics are logged at the I/O seam, and only the winning candidate is hydrated against the live catalog.

Routine skips stay silent: missing, empty, and below-baseline candidates on fresh profiles never reach the error sink (`logStorageFailure`), because browser journeys assert zero runtime errors. Non-object roots and genuinely corrupt JSON do report. Candidate validation reports genuinely corrupt JSON and schema failures of otherwise versioned candidates; storage I/O failures are logged separately. Pinned by `save-version-protection.test.ts`.

`selectSaveCandidates(primary, recovery)` inspects each candidate once and returns
the load state together with the ordered write slots permitted by compatibility. Compatibility
checks protect every newer-format candidate, including stale copies after the
playable winner. The winning raw payload, validated data, and repair notes stay
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

Returning Flight saves store all outstanding card discounts in
`uniqueGear.returningFlightUids`. Discounts follow queued cards across turns and
are consumed independently on play; discarded cards lose unused discounts at the
next turn boundary. Missing references default to an empty list, and hydration
drops duplicate, missing, or ambiguous card references.

## Future schema saves

Saves with a schema or content version newer than the current build are intentionally not migrated. Any playable candidate wins over a newer-format candidate, even when the newer copy has a later timestamp, so a compatible backup or recovery copy can still resume play. If no playable candidate exists, load defaults. The storage owner routes writes away from a slot holding newer-format data when another slot is available.

When only one slot holds newer-format candidates, new saves use the other slot, leaving the newer data untouched. If both slots hold incompatible data, the recovery ring remains the best available write target; older recovery backups can eventually rotate out. A later build evaluates both slots again and selects the freshest playable candidate. No player-facing save decision is required.

Tie rules: playable-vs-playable ties keep the first candidate in read order — primary local ring, primary Cloud, recovery local ring, then recovery Cloud. Future-vs-future ties likewise keep the first candidate in read order for internal diagnostics. Fractional `lastSavedAt` values floor before comparison; missing timestamps fall back per domain (`-1` for future, `0` for the playable pre-filter matching the schema default) via `getCandidateSavedAt`.

## Write acknowledgement

### Submission outcomes

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

### Operation ordering

| Owner                             | Serialized work                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each storage instance             | Loads, writes and clears; loads observe preceding writes and establish permitted slots before following saves; coalescing cannot cross a load barrier |
| `platform-save-backend.ts`        | Local reads/writes/deletion and demo receipts across adapters sharing an IPC endpoint                                                                 |
| `desktop/save-storage.cjs`        | File rings and demo initialization receipts across both slots and renderer reloads                                                                    |
| `desktop/steam-cloud-storage.cjs` | Cloud reads/uploads/deletion across renderer replacement                                                                                              |

Failure releases each lane; failed loads reject their caller without blocking later
work. Writes cannot overtake deletion. Demo import, its local write and initialization
receipt belong to one load operation; a following clear waits, then deletes the import.
Draining and backend replacement account for all queued operations, including loads,
initialization writes, failure notifications and progress receipts from immediate
saves with no awaiting caller. Loads and successful clears resume writes only when
no newer explicit permission decision intervened; selecting recovery grants no permission.

Clear follows the session's [completion lifecycle](../../../../../Docs/RUN_STATE.md#completion-lifecycle):
snapshots are revoked immediately, pending progress survives failure, and overlapping
clears share one pause. [Deletion](#deletion) owns backend order and modes.

Native shutdown closes admission at `will-quit`, after unload handlers can submit
final snapshots, and drains accepted writes. Quitting resumes on the next event-loop
turn after Electron resets its cancelled-quit state, even if the queue was already idle.

### Autosave and exit

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

### Cloud mirroring

Mirroring follows local writing independently, serialized across both slots with
only the newest queued payload per slot. Failure cannot delay local acknowledgement.
Clear cancels queued mirrors and waits for active uploads before Cloud deletion,
including uploads admitted by a departed renderer. Following reads observe deletion;
failures release the lane. Account and recovery policies remain unchanged. Native operations check both
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

## Load order

Candidate compatibility/freshness prefilter → current-shape validation and normalization → winner selection → active-run card hydration → codec hydration and restore. Below-floor and future formats never enter current-shape validation. `SaveDataSchema` is a load-tolerant shape validator; raw-version acceptance belongs to candidate evaluation and must occur first. Test-only direct parsing is not the compatibility gate. Repair follows the owners in [defaults and resume normalization](#defaults-and-resume-normalization); after winner selection, `toActiveRunData` hydrates its run deck, draft choices, Card/Alchemist shop cards, Mystery cards, Corruption pair, and Campfire/Transmutation cards. Battle piles hydrate later through `restoreActiveBattle`; candidate evaluation does not publish gameplay state.

## Implementation rules

- Card IDs that disappear from the live catalog are stripped against the live catalog at load in `normalize-active-run-data.ts`. Record deliberate removals in `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts` so fixtures stay explicit. The guard test in `save-migration-guard.test.ts` checks `discoveredCardIds` for catalog or tombstone membership; deck, shop, battle, mystery, and corruption piles rely on silent live-catalog stripping without a tombstone requirement.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. Filtering can leave an empty deck; the battle engine handles empty piles through Emergency Wish. No player-facing diagnostics.
- Card validation and hydration treat saved effects and descriptions as one content unit. `BattleCardSchema` returns an empty effect list if any effect fails validation, including nested effects; missing or malformed lists likewise become empty. `hydrateCard` preserves both saved lists only when both are usable, without comparing their lengths against the current catalog. Otherwise it restores both from the library and clears saved `corrupted` and `baseTitle`. Valid saved cost, UID, and explicit Consume overrides survive; title, art, and catalog metadata refresh from the library. The empty-list recovery signal survives normalization and JSON round trips without extra saved fields.
- Cards may persist a structured `description` alongside the existing `descriptionLines`. Its literal parts, semantic line roles, stable magnitude identities, typed effect references, formatting, and corruption marks are data-only. Validation checks structure and actual effect kinds, numeric fields, nested paths, agreement across shared values, and identity consistency. Valid bindings regenerate cached text, including after missing or stale caches; malformed bindings are discarded with a diagnostic while valid effects and text retain the existing recovery policy. Records without bindings still load as complete saved effects/text units; subsequent mutations derive canonical bindings from their effects, never by parsing saved prose. Current-format custom wording and Mixed Potion ingredient boundaries persist through the structured model. Corruption and Distill marks persist on magnitude identities; character offsets and derived localization messages are not saved. The schema version stays unchanged because effects and bindings retain their meanings. Clone and hydrate deep-copy references and nested paths, and catalog metadata never overwrites a saved description model.
- The same card validator covers active-run card locations and saved battle deck, hand, discard, exhausted, Wish options, and Wish queue, in the committed battle activity. Battle card hydration occurs when `restoreActiveBattle` restores the session; other card locations hydrate through `toActiveRunData`. Complete valid saved modifications survive even when their effect count differs from current content. Incomplete content recovery may reset card modifications, but requires no schema bump because the persisted shape and valid values retain their meanings.
- Card arrays keep valid entries when a sibling card is malformed, with a developer-facing repair warning for each dropped position. Missing or non-array run decks still invalidate the run. Shop and Alchemist purchase keys follow surviving cards to their new slots. A Wish prompt emptied by malformed or removed cards advances to the next nonempty queued choice, or closes when none remains, so resumed combat stays playable.
- Battle normalization repairs invalid Mana to zero and enforces the current minimum of one Mana Crystal. Valid unspent Mana and overflow above the crystal count survive resume.
- The `SaveLoadStatus` shape has five variants: `ok`, `unavailable`, `unsupported-newer-schema`, `unsupported-newer-content`, and `corrupt`. These are internal diagnostics; none blocks play or opens a save-problem screen. The `ok` variant may carry developer-facing `warnings` (repair notes such as dropped card content); these never gate loads and are not shown to players.

## Four-tier Homestead

Building, farm, and research level bounds come from the current four-tier catalog;
existing levels retain their values and level four survives reload. Companion
Bonds keep three tiers. New numeric Homestead combat fields default to zero in
the talent manifest and rebind from purchased levels during run restoration.
Preserve resolved starting Thorns, pending modified Wish materials, and RNG;
never replay opening grants or apply find bonuses again while rebinding.
[Homestead rules](../../../../../Docs/TALENT_RULES.md#talent-manifests-and-progression)
own effects and discounts; find bonuses modify eligible rewards at their source.

Reset Homestead persists zeroed node/bond levels and the refunded material
stockpile in one command. Refunds use current catalog tier costs; hydration only
recomputes effects and never refunds again. Discovery remains independent from
bonds. Purchase feedback is presentation-only and never serialized; no refund
ledger is needed.

## Shared run-progress shape

`lib/active-run-session/run-progress.ts` owns `PersistedRunProgress` and its exhaustive `ACTIVE_RUN_PROGRESS_KEYS` projection. `ActiveRunData` extends those shared fields; `ActiveRunProgressFields` narrows destination names for live state. Saved callers remain permissive about historical destination names until normalization. The save schema in `lib/validation/save-schemas/run-progress.ts` checks every field against that contract and owns recovery defaults. Fresh-run constructors still own starting decks, seeded RNG, fresh collection instances and zero earned totals. Missing `runHistoryPartial`/`runGoldEarned` still recover as `true`/`null`; never replace those with fresh-run defaults. New fields require the domain contract, exhaustive projection, schema and meaningful fresh/resume initialization.

`lib/validation` owns `parseActiveRun`, `toActiveRunData` and conversion of parsed Mystery choices into domain effects. Session contracts, activity helpers and live constructors never import validation. `PersistedPendingReward` belongs beside the domain reward types; its save schema checks that output contract. This changes module ownership only, with no save-format or recovery-default change.

## Demo account identity and transfer

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
path can select another account. No save-schema change is required.

Permanent
progress import, separate cloud filenames and initialization receipts are owned
by [Steam demo](../../../../../Docs/STEAM_DEMO.md). Receipts survive Clear Save Data;
no active run or full-Campaign win credit is imported. Public demo carryover freezes
the supported baseline just like a full release; never retire promised progress.

## Alchemy visits and modified cards

Campfire and Transmutation are branches of `activeRun.activity`, each carrying
its `AlchemyVisit` data. They are not separate optional top-level visit records.
Save fixed offers, original/result cards, and completion together. Uninitialized
visits receive offers on entry; initialized visits survive resume without
rerolling or repeated grants. Campfire Rest/Brew and Alchemist Mix/Distill limits
survive reload; eligible Potions may be brewed again at later visits under the
[brewing rules](../../../../../Docs/GAME_RULES.md#brewing-transmutation-and-elemental-reactions).

`AlchemyVisit.transmutation` additionally saves each keyword choice's exact
alterations, including source snapshots/indices, selected source keywords, and
result cards, plus the current source/keyword/preview selection. Prismatic
Crucible selections may reference any compatible keyword beyond the normal
three offers; validation bounds indices by the registered Transmutation keywords.
This widens accepted selections without changing the saved shape. Hydration
restores every source/result card. Completed Transmutation follows the saved-result and missing-result
[interaction contract](../../../../../Docs/UI_BROWSING.md#campfire-and-transmutation). Retired
replacement-card offers repair to an uninitialized selection, not a parallel
workflow.

Modified cards retain effects, descriptions, explicit Consume overrides,
`transmuted`, `baseTitle`, and added tags together. Optional `lifesteal` on random
damage and cleanse-to-damage preserves Transmutation's Leech addition; omission
does not grant Leech. Structured description magnitudes retain `distilled` marks
through hydration and mixing so upgraded values remain green. These compatible
additions use safe defaults without a schema bump; incompatible changes still
follow the [supported baseline](#supported-baseline).

## Starter Homestead grant

`starterHomesteadGrantResolved` is an additive permanent run-profile boolean.
New careers start false. Missing or malformed values recover as true when any
valid Homestead tier or Companion Bond is purchased, otherwise false. Valid
saved booleans survive unchanged. Claiming the first Campaign Act I boss reward
resolves the receipt atomically with any material top-up. A successful Homestead
purchase also resolves it. Homestead reset preserves it; Clear Save Data resets
it. No schema-version increment or supported payload transformation is required.

## Localized descriptions

The renderer derives localized messages from literal parts, effects and magnitude bindings when they are displayed or extracted. Template IDs and keyword/magnitude slots are not persisted; saved cache metadata cannot replace valid mechanics. Current-format cards, custom wording, Mixed Potion grouping and upgrades remain intact. Unknown legacy templates remain playable in English. The device-local language preference is outside the progress envelope and Steam Cloud; no save-version change is required. See [Localization](../../../../../Docs/LOCALIZATION.md).

## Battle decoding and semantic repair

The wire schema validates structure and scheduled/card collections before semantic
repair. `DecodedPersistedBattle` deliberately leaves enemy identity, status,
reaction and flag records untrusted; normalization validates those records and
then repairs resources, pile identities, and cross-field survival relationships.
Optional card metadata is omitted when absent, matching the runtime card type.
The runtime activity layout does not change the serialized reward/destination
payloads or save version.

## Independent Alchemist services

Alchemist visits retain `brewOffers` plus independent `brewUsed`, `mixUsed`, and
`distillUsed` flags. New visits roll three fixed Brew offers from the shops RNG;
refreshes preserve them and all spent flags. Hydration preserves current saved
offers and flags; missing additive fields default to an empty recipe list and
unused services without replaying randomness. No schema bump is required.
