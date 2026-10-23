# Run state and persistence

Session state, command atomicity and persistence capabilities live here.
[Save compatibility](../src/features/alchemy/shared/storage/MIGRATIONS.md) owns
format acceptance, file/Cloud transport, fallback writes and deletion modes.
[Run workflows](./RUN_WORKFLOWS.md) gives editing steps.

## Core model

| Stage              | Guarantee                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Execute            | One synchronous command owns the draft, validation and RNG; rejection or execution failure rolls everything back          |
| Publish            | Changed gameplay becomes one immutable revision before observers run; settings and presentation remain separate owners    |
| Present            | Playback consumes detached results; cancelling presentation cannot undo or advance gameplay                               |
| Save               | A covering local write releases completed-action feedback; retry saves the committed outcome without repeating the action |
| Replace or dispose | Restore invalidates old work at commit; disposal revokes capabilities and drains submitted saves                          |

For editing steps, start below. Detailed contracts follow under
[commands](#command-atomicity), [sessions](#session-ownership),
[local saving](#completed-actions-and-local-saving) and [persistence](#persistence-api).

## Common implementation paths

Start with a matching production example and its regression test. For an existing
action, edit its domain command; the shared operation already supplies transaction
and session protection. Do not reconstruct the entire route/controller chain. Extend that
owner when it already represents the action; add a boundary only when a distinct
consumer or invariant requires it. These are entry points into existing code,
not templates to duplicate.

| Change            | Follow this production path                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Executable example                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Merchant purchase | Route command → [merchant commands](../src/features/alchemy/run-loop/shop/merchant-shop-commands.ts) → [shared purchase operation](../src/features/alchemy/run-loop/shop/shop-commands-core.ts) (including the transaction guard). Price, availability, payment and acquisition use the same draft.                                                                                                                                                                                         | [Shop actions](../tests/features/alchemy/run-loop/shop/shop-actions.test.ts)                              |
| Card play         | Battle controller → [battle commands](../src/features/alchemy/shared/stores/commands/battle-commands.ts) → production resolution → committed result → route playback. Supply the offered snapshot; the command rejects stale inputs before consuming RNG.                                                                                                                                                                                                                                   | [Battle input ownership](../tests/features/alchemy/shared/stores/commands/battle-input-ownership.test.ts) |
| Saved run field   | [Save fields](../src/features/alchemy/shared/stores/persistence/run-profile-save-fields.ts) → [profile codec](../src/features/alchemy/shared/stores/persistence/run-profile-codec.ts) → [resume codec](../src/features/alchemy/shared/stores/persistence/run-resume-codec.ts) → [restore](../src/features/alchemy/shared/stores/persistence/run-restore.ts). Update schema/defaults and fixtures together under [save compatibility](../src/features/alchemy/shared/storage/MIGRATIONS.md). | [Resume roundtrip](../tests/features/alchemy/shared/stores/persistence/run-resume-roundtrip.test.ts)      |

Run a matching example directly, then use the task gate for changed paths:

```sh
npm run test:unit -- tests/features/alchemy/run-loop/shop/shop-actions.test.ts
npm run test:unit -- tests/features/alchemy/shared/stores/commands/battle-input-ownership.test.ts
npm run test:unit -- tests/features/alchemy/shared/stores/persistence/run-resume-roundtrip.test.ts
```

Shop purchase/refresh recipes and `runShopTransaction` live together in
`shop-commands-core.ts`; payment, acquisition, rollback and post-commit feedback
remain under one transaction. Merchant removal and Alchemist mixing use that
same guard directly.

Composition wrappers such as `createShopActions` and session capability bindings
retain a specific role: assembling route authority and revoking retained actions
when the session ends. Keep those ownership checks when simplifying forwarding.

## Run state

Each game session owns one data-only gameplay aggregate in
`shared/stores/session/gameplay-state.ts`. Its regions are listed below.
Reusable reads, commands and codecs neither import React nor initialize the app.

- **Reads:** `gameplay-state-reads.ts` supplies explicit-session reads and
  subscriptions; `session-gameplay-store.ts` caches each session's presentation
  projection; `gameplay-state-store.ts` adapts the default application.
- **Writes:** intent commands compose `run-session-write-port.ts`,
  `homestead-actions.ts` and `gear-actions.ts`. Features receive live, deeply
  readonly `RunTransaction` reads. Raw `GameplayDraft` access belongs only to
  store-owned mutations and bootstrap hydration.
- **Domain adapters:** `session/profile-store.ts` and `session/gear-store.ts`
  read the aggregate without shadow state. Their codecs live in `persistence/`;
  React profile slices use `use-profile-store.ts`.

Use the [capability ports](#session-capability-ports) and `run-lifecycle.ts` for
feature orchestration; independent runtimes follow [session ownership](#session-ownership).

Committed gameplay is immutable in every build. `createGameplayStore` freezes the
complete initial aggregate and each new revision before save-status or gameplay
observers run. Read ports borrow those stable references; reads never freeze or
copy live state as a side effect. Projection wrappers may be changed locally,
but their nested gameplay values remain protected. Commands use Immer drafts;
input ownership and detached command results stay at the transaction boundary.
Freezing caches fully traversed objects, so later revisions traverse only changed
branches and retain structural sharing. Publication validates the changed graph
before freezing: gameplay accepts plain records and arrays, never functions,
accessors, bigint/symbol values, non-finite numbers, or built-ins with mutable
internal slots such as Map and Date. Invalid values reject publication before
they can turn into missing or null fields in a save.
Detached command results retain their broader supported data types; they do not
become gameplay state. Settings and progress-status snapshots are also frozen,
so borrowed reads cannot bypass their notification and persistence paths.

| Aggregate region | Concern                                                                                                                                                                                    | Lifetime                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `run`            | Deck, HP, acts, run Boons on `run.activeRun`; presentation screen on `run.navigation`; one resumable active run                                                                            | Resets on run termination                                                                                          |
| `session`        | One active activity/visit, rewards, labyrinth progress, pending selections, and run-flow claims                                                                                            | Per live run; active visits persist via the resume codec; the run’s reward bundles persist in `activeRun.activity` |
| `runProfile`     | Homestead (buildings/farms/research/companions), talent XP / unlocks, derived `effects`, and the shared gold purse — persisted as flat top-level save fields via `run-profile-codec` codec | Profile lifetime                                                                                                   |
| `profile`        | Collection discoveries, completed difficulties, and finished-run character unlocks; collection tab/page UI is transient in-memory, outside `ProfileSaveFields`                             | Profile lifetime                                                                                                   |
| `gear`           | Permanent inventories, loadouts, and crafting currencies                                                                                                                                   | Profile lifetime                                                                                                   |

Active combat belongs to `session.activity`: its `"battle"` variant carries the
committed `battleState`. Opening and turn playback frames stay with presentation. There is no independently
stored active-battle flag or inactive gameplay snapshot. Read ports derive
`hasActiveBattle` from that variant and provide a stable empty display fallback.
`enterBattle` validates a live non-combat starting activity; `settleBattleVictory`
replaces combat with rewards in one operation. Victory waits for pending Wishes
to settle, even when the enemy falls during its own turn. The battle remains
resumable during those choices. Hero defeat still ends combat immediately.
Run termination makes activity
inactive and removes command access to combat in the same transaction. Card,
Wish, and end-turn commands reject absent combat; end turn also checks the player
input phase and pending Wishes. Duplicate starts and victory settlements reject
without publishing state or consuming RNG.

The battle route retains its outgoing display data through delays and fades.
Outcome playback transfers its final frame into `battle-presentation-store`
before settlement removes combat. Those retained frames are presentation only,
never gameplay command inputs or resume data. Presentation publication detaches
caller-owned data; `copyForPublication` borrows only branches already validated
and deeply frozen by `deepFreeze`. A shallow `Object.freeze` does not qualify.
This retains immutable structural sharing across playback frames without
freezing or retaining mutable caller-owned branches. Menu and meta navigation remain
independent of activity, so an unfinished battle stays resumable there.

Live reads and screen data expose `runProfile.gold` as `gold`. `profile` never owns gameplay currency. Homestead and talent mutations rebind live Health and battle manifests through the owning command. Battle VFX live separately in `run-loop/battle/` (state in `battle-presentation-store.ts`, overlays in `presentation/` leaves) and are not persisted.

### Command atomicity

`dispatchRunSessionCommand()` in `run-session-command.ts` opens one Immer draft
of the authoritative aggregate. Return `acceptCommand(value)` or
`rejectCommand(reason, fallback)`; the dispatcher returns the payload without
changing route-facing result shapes. React selectors and autosave observe the same root.

| Outcome                                | Publication                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Accepted with changes                  | New immutable root and one incremented revision                                            |
| Accepted without changes               | Same root and revision; still eligible for `afterCommit`                                   |
| Rejected                               | Discard all draft changes, including RNG counters; same root/revision and no commit signal |
| Execution or result-validation failure | Abort before publication; no partial state or RNG changes                                  |

Acceptance is independent of payload truthiness: act advancement or obsolete
claim cleanup may accept `false`. Shop adapters reject `committed: false`; Gear
adapters reject operation failures (`false`/`null`). Raw values are not command outcomes.

#### Transaction reads and lifetime

- Compose domain operations inside one command, passing its transaction explicitly;
  never dispatch a nested command. Guards for Gold, refreshes and purchased slots
  read the live draft, not a committed read port.
- Transaction reads update with writes but remain deeply readonly under TypeScript
  and runtime guards. Functional setter updaters return replacements rather than
  mutating previous values. Validate first where possible; later rejection still
  rolls back the whole command.
- `run-session-write-port.ts` adapts existing mutators without another store.
  Import boundaries restrict raw dispatch, draft lookup and read-facade internals.
  Reads/subscriptions expose no `setState` bypass; only persistence adapters may
  subscribe directly to the commit signal.
- Writes, RNG and instance-ID capabilities expire with their originating draft.
  Retained handles cannot write in `afterCommit` or another command, even in the
  same session. An external closure cannot extend their lifetime.
- Commands cannot span `await`. The factory and Gear wrappers reject Promise-like
  result types, including unions; runtime checks reject thenables before publication.
  Rejected continuations are observed to avoid unhandled rejection, but external
  work already started by an invalid callback cannot be cancelled by this boundary.
- Input preparation, updater, mutation or Gear Health-rebinding exceptions call
  `abortGameplayCommand`. The first failure remains until the draft closes, even
  if a recipe catches it. Expected validation failures use rejection; exceptions
  abort that command only.

#### Boundary data

`boundary-data.ts` owns one graph traversal for setters, explicit snapshots and results.
All supported containers preserve aliases, cycles and own data properties, including
symbol-keyed and non-enumerable metadata.
Caller-owned setter inputs detach; existing transaction reads retain their owned
source. `snapshotTransactionValue(value)` detaches reads for engine APIs requiring
mutable types. The dispatcher detaches accepted results and rejected fallbacks
before Immer closes, so draft proxies never escape into playback. The same detached
result reaches `afterCommit` and the caller; wrappers perform no second conversion.

| Data                             | Contract                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Records and arrays               | Plain and null-prototype records supported                                                                                   |
| Maps, Sets, Dates, RegExps       | Preserve container relationships, timestamps, pattern/flags and `lastIndex`                                                  |
| Accessors or other prototypes    | Reject before publication; never flatten through a fallback clone                                                            |
| Functions or Promise-like values | Reject anywhere in a result, including nested rejected fallbacks; types check known inputs and runtime checks untyped inputs |

Results are independent of committed state. Run-profile codecs detach on encode
and hydration; restoration owns the full active-run graph before decoding or
rebinding and never freezes or mutates the caller's save. `snapshotRun()` and the
complete save builder return detached data; internal resume projections may borrow
immutable branches.

#### Publication and observers

Install the complete root and arm persistence/presentation protection before
notifying observers. Save-status subscribers see the revision being saved.
Gameplay and save-status callbacks run while the command guard is held: they may
read, but follow-up commands belong in `afterCommit` or after dispatch returns.

`notification-channel.ts` supplies synchronous FIFO delivery for gameplay, settings,
progress, save status, storage interruptions and lifecycle channels. Each publication
captures its listener set; subscription changes affect the next publication.
Observer-triggered publications wait until the current event reaches every listener.
Ordinary unsubscribe preserves the captured set; session disposal immediately stops
remaining callbacks and queued publications. Diagnostic handlers isolate listener
failures so later subscribers, autosave and completion effects still run.
Execution failures roll back; arbitrary `afterCommit` failures propagate with the
committed state retained.

Store-owned restore commands stage normalized settings before execution, then
install gameplay/settings, replace the save acknowledgement epoch and arm pending
save protection before notification. Decode, preparation, rejection or result-validation
failure leaves both stores, pending protection and completion callbacks unchanged.
Feature commands cannot request restore publication mode.

### Post-commit behavior

Audio, navigation timers, presentation updates, and other non-rollbackable work
use `afterCommit` or run after the command returns. Every normally returning command
runs `afterCommit` exactly once when accepted and its session remains active,
including no-op assignments and accepted `false` results. Rejection, thrown execution
errors, and disposal during publication skip it. Disposal retains the committed
result but revokes follow-up effects before they start. Rejection
feedback belongs outside the transaction and can use the returned fallback value.

The command guard is released before `afterCommit`, so an effect may dispatch a
separate command. If an effect throws, its error propagates and the already
committed state remains; post-commit errors do not roll back gameplay.

`afterCommit` confirms an in-memory commit, not a durable save. Completed player
outcomes follow [completed actions and local saving](#completed-actions-and-local-saving)
through the same session's `SessionPersistence.afterProgressSaved` capability.

Session feedback adapters are an explicit exception to error propagation.
`shared/stores/session/session-effects.ts` isolates each audio/UI adapter and lifecycle
listener, logging its failure without aborting the caller's remaining work.
Execution and persistence errors retain their own failure contracts; the command
dispatcher does not suppress arbitrary `afterCommit` errors.

The same owner provides each session's restore, presentation-clear, and teardown channels.
Accepted restore publication invalidates deferred navigation and restarts mounted
battle playback before clearing outgoing battle presentation, then notifies settings,
progress, and gameplay observers. `onRunRestored` listeners perform cancellation
only, while the command guard remains held. This applies even to equal-data restores
and bootstrap hydration that preserves an initialized run: their old presentation
work still refers to the previous inputs. Failed restores emit no invalidation.
Session disposal also cancels mounted playback without waiting for React unmount.
Successful Clear Save Data uses this same replacement publication after disk
deletion, including save-receipt and presentation invalidation. Settings and
gameplay reset together before any observer can snapshot the new career; failed
deletion leaves the current state and pending presentation intact.

Teardown always clears battle UI, notifies presentation cancellation, then notifies
run teardown, even if an adapter or listener fails. Listener changes apply on the
next notification. Run abandonment and defeat submit their settled save before
these effects; neither requires a route adapter to remember presentation cleanup.

### Committed battle playback

Battle reads expose serializable `BattleSnapshot` values. Opening draws and card
plays commit before presentation. `commitEndTurn` resolves the turn and its
Companion follow-up with the engine-owned `resolveBattleAction` end-turn request,
awards Dodge XP only after acceptance, and publishes the result atomically before
discard or enemy animation.

`BattleState` is the engine's execution shape, which may carry RNG, action
callbacks, execution observers, and a Wish-offer sampler. Use `battleSnapshot(state)` when converting engine or fixture state
to committed data; a type assertion does not remove executable fields. The
helper strips all execution metadata without drawing RNG or resolving gameplay.
Inspection strips those borrowed capabilities before binding its own isolated
resolution inputs; observer and sampler callbacks never enter committed state.

Playback consumes detached `BattleTurnFrame` values and updates only
`battle-presentation-store.displayedBattle`; cancellation or failed animation
cannot roll back or advance gameplay. Inside store-owned battle commands, narrow
`draft.session.activity.kind` to `"battle"` and pass
`current(draft.session.activity.data.battleState)` to the resolver so no revoked
Immer proxy can escape. Feature callers consume the detached command result
through battle capabilities rather than accessing the raw draft.

An active terminal battle remains serializable until its outcome settles. Saves
contain one committed snapshot in `activeRun.activity`. A selected nonterminal
snapshot marked as an enemy turn requests load-time abandonment: atomic turn
resolution has no resumable intermediate enemy phase. Restore settles earned
progress through the current abandonment command before showing End Run, without
replaying turns, Companion actions, Gold deltas or RNG. Terminal snapshots use
normal outcome settlement. Below-baseline development formats follow the
[save compatibility policy](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).
`playerDodgeCount` and `dodgeChanceFromDamage` remain battle-owned and persist.
The Health-damage boundary requires explicit `hostile` or `self` provenance for
Finding Rhythm; Health costs do not award it.

## Session ownership

`shared/stores/session/game-session.ts` exposes `createGameSession({ initialSave, saveBackend, runtimeInputs })`.
A session owns one career: permanent progression plus its sole active run. Its opaque
`GameSession` handle exposes disposal; gameplay access still goes through capability
reads and intent-level commands. Independent sessions do not share aggregates,
settings, command guards, storage queues, failure status, or lifecycle channels.

Imperative reads, commands, codecs, storage operations, and controller factories
require an explicit final `GameSession`; they never fall back to another career.
For preceding optional inputs, pass `undefined` when omitted, for example
`dispatchRunSessionCommand(execute, undefined, session)`. Domain operations inside
an open transaction continue to take the transaction, not another session.

Bind capabilities once at controller composition: `createBattleCapabilities`
provides combat reads and commands; `createRunRouteActions` provides navigation
reads and route actions; `createShopActions` binds shop operations; and
`createSessionPersistence` binds snapshots, restore, subscriptions, and save IO.
Deferred playback consumes `BattleControllerContext.battle`, so it cannot choose a
career implicitly. Bound methods retain ownership when passed individually and
reject use after disposal. `bindSessionCapabilities` and `assertSessionOwnership`
delegate to `session-capability-graph.ts`, which validates the complete nested
capability graph before binding. Groups are detached, immutable plain records or
arrays; methods retain ownership when extracted or spread into another group.
Aliases, cycles, symbol keys, and non-enumerable groups are preserved and checked.
Accessors and opaque class/container instances are rejected rather than executed
or silently skipped. Bound groups cannot be altered after validation, and every
newly bound method checks session lifetime before execution. Flow and Labyrinth routing
reject mixed-session outcomes, navigation, battle commands, and node callbacks
before they can mutate gameplay. Composition binds and captures incoming groups,
including nested dependencies, rather than retaining caller-owned objects after
validation. Later replacement of a caller's methods or groups cannot change the
assembled controller. Pure presentation callbacks need no session.
Outcome handlers remain constructed before battle controllers; their separate
composition is checked rather than replaced with late callback binding.

The singleton is constructed only in `app/application-session.ts`. `App.tsx`
passes its session and battle presentation store to `useAlchemyRunController`;
that controller passes the same dependencies to battle and navigation hooks.
Steam rich presence is composed in `App`, and autoplay toggle sounds use the
session feedback capability.
`use-session-run-reads.ts` supplies narrow explicit-session subscriptions, and
`session-settings.ts` supplies imperative settings for battle autoplay. Battle
presentation stores carry session ownership, so mixed-career composition fails
before gameplay. A mounted battle controller owns one session/presentation pair;
changing careers requires remounting that controller.

`session-gameplay-store.ts` caches each session's presentation projection separately.
Pending saves retain that session's pre-action gameplay while navigation, Collection
browsing, and Labyrinth inspection remain live. Its subscriptions detach on unmount
or session disposal. Application screen hooks retain their default-session adapter
without adding a provider. The explicit shipping adapter list in `lint/session-ownership.js` covers application hooks,
routes, and presentation adapters, including those under feature directories. The Oxlint
session-ownership rule and dependency boundary prevent reusable domain modules
and headless playthroughs from importing the singleton; Oxlint also rejects
optional or defaulted session parameters. Runtime internals remain store-owned,
with scoped exceptions for save IO, hydration, and singleton construction.

`runtimeInputs` supplies the clock, new-run seed generator, and Gear instance ID
source. Runtime-input and feedback methods are captured with their supplied object's receiver,
so plain-object and class-based implementations behave alike. Gameplay RNG remains persisted on the run and changes inside transactions.
ID generation reaches pure loot helpers through `createDraftInstanceIdSource`;
those helpers do not import the runtime. The legacy test seed override affects only
the default application adapter. New isolated tests inject their own seed source.

Independent sessions require an explicit `saveBackend` to write durably; without
one, IO remains unconfigured and skips writes even in a browser. Only the application
adapter uses the platform backend by default. Sessions can inject feedback callbacks;
independent sessions default to silent presentation. Device-local display preferences
and the local error buffer remain application services.

`GameSession` supports `await using` and explicit `await session.dispose()`: both
remove subscriptions, cancel autosave/navigation work,
clear lifecycle channels, drain already-submitted saves, and disable further
writes. Commands and reads reject disposed handles. Disposing one session cannot
cancel another session’s timers or writes. `session-lifetime.ts` owns resource
registration and the clock's timer inventory. Closing the lifetime revokes feedback
and borrowed store methods, detaches progress subscriptions, and cancels every
registered timer before draining submitted saves. A timer callback already handed
to the host checks lifetime again before executing. Timer cancellation and
subscription release remain safe after disposal; new reads and work reject.
Gameplay, settings, progress, save-status, and lifecycle notification channels
borrow the same lifetime predicate. Disposal during notification revokes later
callbacks in that publication as well as queued reentrant events. Restore and
teardown also stop their remaining presentation work once their session closes;
already-submitted storage work still drains.
Notification-channel subscriptions and registered cleanup handles remain callable and also
support `using`; `lib/cleanup.ts` owns their idempotent explicit/scoped release.

## Activity and rewards

Campaign and Labyrinth room entry use `enterRunRoom` in
`run-loop/run/room-entry-commands.ts`. Its typed request selects an offered
Campaign destination or the selected reachable Labyrinth node. Validation,
activity initialization, encounter traits, history/progression, and seeded RNG
commit together. Rejection and initialization errors preserve the previous root
and revision. The returned screen and detached opening battle feedback contain
no gameplay mutation callbacks; shell navigation and feedback run after entry.
A presentation error does not undo accepted room entry.

Campaign claims its destination inside the transaction so loot depth includes the
entering room; Labyrinth records its node before opening combat. The shell schedules
Battle before presenting opening feedback, so an immediate Companion outcome can
supersede it, including routing directly to Rewards before the Battle fade commits.
`room-visit-initialization.ts` supplies transaction-only visit recipes to that owner. Screen and shop command contracts
expose player actions without initialization. Rendering, remounting, and presenting
Mystery never sample visit RNG or replace committed activity.

`session.activity.kind === "inactive"` is the sole stored marker for an inactive run. Active runs may have `idle` while being prepared; meta screens preserve the current activity. Read ports derive `hasActiveRun`; it is not a second stored boolean. Reward activities own their bundle and Companion follow-up cards; destination activities own only their offered destinations and boss/victory context. `session.progressClaim` owns the one claim union (`idle`, `reward`, or `destination` with its captured offer), so replacement activities cannot invalidate an accepted navigation handoff. Reward and destination claims cannot both be active. `readRunSession().rewardFlow` is a derived compatibility view, never stored authority. The visible navigation screen remains independent so menus and fades do not redefine the resume location. Save codecs retain the existing wire fields.

`reward-commands.ts` owns selection validation, grants, and advancement to the next reward bundle in one transaction. Its claim lock prevents re-entry until routing settles, but save encoding uses the already-advanced bundle rather than inferring which reward was awarded from the lock. Legacy `companion-reward` saves remain readable. `victory-commands.ts` owns victory rewards and the Wildwood phase change, rejects repeated completion, and enters the rewards activity atomically. The matching run-flow modules own navigation and feedback.

Activity encoding follows the [persistence API](./RUN_STATE.md#persistence-api); [navigation data flow](./BATTLE_CONTROLLERS.md#data-flow) defines when preparation commits.

## Anti-patterns

- No all-screens display bag or second flattening read model. Each route owns its exact screen-specific hook (`RunScreenDataByScreen`, inferred from the selectors in `run-screen-data.ts`). Menu badge dots (`useMenuBadges` in `src/app/app-screen-chrome-context.tsx`) are the blessed exception: they derive talent/homestead affordability only on the Menu route, never through the always-mounted chrome provider. Screens must not import app-shell orchestration (`SCREENS_NO_APP_ORCHESTRATION`); leaf capability modules (`escape-stack`, `screen-particle-config`, chrome context) stay allowed.

## Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Commands obtain generators through `createDraftRunRandomSource(draft, stream)` so counters commit or roll back with gameplay. `BattleSnapshot` contains only data. Battle commands pass the world's generator in `BattleResolutionContext` to `resolveBattleAction`, which binds it to execution-only `BattleState` values for the engine handlers. That context also supports action scope and empty-draw handling. Engine draws use `getBattleRng(state)`. `battleSnapshot` removes those execution dependencies before publication or return. Stored snapshots and presentation frames contain no RNG callback. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw.

Destination offers use the `destinations` stream for sampling. They draw a boss from `world` only when the offer contains Boss Combat alone and has no saved boss ID. Ordinary offers and resuming a valid boss preview do not advance `world`.

`Math.random()` may create a fresh run seed or presentation-only values that cannot affect gameplay or persisted state. [Armory crafting and dev spawning](./ARMORY.md#write-paths) are the intentional gameplay exception: they use injected profile-lifetime randomness, defaulting to `Math.random`, without consuming a run stream. Salvage instead derives its fixed reward seed from the item instance ID. Other run outcomes use the persisted streams above.

Run-luck helpers live in `@/lib/rng` (the single door), small math in `@/lib/math`, and class-name/string/id helpers in `@/lib/utils`. Every draw stays in `[0, 1)`; unknown streams, out-of-range draws, empty ranges, and negative sample counts throw in every build. Counters hash as `counter + 1` and wrap to the hash's 32-bit range, so increments cannot stall and resume continues at the exact next draw. Snapshot-only placeholders always draw zero and must never reach live combat. Full battle RNG + arithmetic rules: [GAME_RULES](./GAME_RULES.md).

`pickWeighted(items, weightOf, rng)` owns weighted selection for destinations, loot, and Corruption. It evaluates finite non-negative weights once, uses half-open buckets in item order, and consumes one draw for a positive pool, including a single eligible item. Empty or all-zero pools return `undefined` without drawing; each caller owns its unavailable-pool behavior. Floating-point fallback selects the last positive weight. Integer magnitude and map-position rolls use `rngInt`, retaining one draw even for a fixed value.

Choosing one encounter trait draws once from its eligible pool. Wildwood boss preparation draws once for its combat trait and once for its reward trait after selecting a boss; refilling the boss bag has its own draws.

## Completed actions and local saving

The renderer marks persisted gameplay commits as pending before publishing them.
`ProgressCompletion` owns the pre-action presentation baseline and player-action admission alongside acknowledgement. Commands and settings capture that baseline through its mark/replace operations; presentation readers and command guards consume the same owner.
`SessionPersistence` exposes `checkpoint`, `readProgress`, `subscribeProgress`,
`trackProgress`, `retryProgress`, and `afterProgressSaved`. A checkpoint carries
the gameplay revision and a runtime epoch; only a covering local write in that
epoch acknowledges completion. The save envelope does not gain scheduling data.
Acknowledgements, deferred feedback and storage cancellation are session-owned,
independent of autosave subscriptions. `trackProgress` registers an idempotently
released retry driver. The newest live driver handles Retry; releasing it restores
the preceding driver without affecting other registrations or acknowledging work.
A replacement durable driver schedules pending progress without another gameplay
action. Without one,
pending state and pre-action display remain protected; Retry checkpoints directly.

Retry captures the career/checkpoint before status notification, then uses the
latest driver. Replacement or cancellation during notification revokes the request.
If the driver detaches or throws before saving, persistence checkpoints directly.
Retry always saves the committed outcome without repeating gameplay.

Player-facing store hooks retain the immutable pre-action progress until saving
succeeds. Transient navigation, Collection browsing, and inspection remain usable.
Domain reads continue to see the committed state. Player command entrypoints reject
additional progression while saving or after failure; internal combat and terminal
settlement commands still resolve synchronously. The renderer groups synchronous
commits into one immediate checkpoint rather than waiting for the ordinary autosave
debounce. Presentation and local saving must both settle before another action.

[Storage acknowledgement](../src/features/alchemy/shared/storage/MIGRATIONS.md#write-acknowledgement)
owns write outcomes, fallback and automatic retry timing;
[UI feedback](./UI.md#pending-saves-and-action-feedback) owns Saving/Retry presentation.
Explicit Retry resets its submission latch without changing exit deduplication.
Explicit checkpoints, including settings-only changes, require a new acknowledgement
even at the same gameplay revision. Snapshot tokens carry both versions; an older
successful write cannot release a newer gate or its feedback.

### Completion lifecycle

| Event                          | Pending progress and feedback                                                                                        | Save scheduling                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Deletion requested             | Retain the action, pre-action display and completion callbacks; revoke submitted snapshots                           | Pause autosave; newly attached clients read the deletion gate before scheduling                                |
| All overlapping deletions fail | Keep the action protected and retryable                                                                              | Resume with a fresh current-career snapshot, including settings-only changes                                   |
| Any deletion succeeds          | Discard the old pending work and stale feedback                                                                      | Keep writes paused until every overlapping deletion finishes                                                   |
| Restore commits                | Replace the acknowledgement epoch at commit; protect the replacement continuously until saved; revoke stale feedback | Invalidate old scheduling before observers schedule replacement work, so late writes cannot cancel new retries |
| Restore fails                  | Retain the previous epoch, pending action and deferred feedback                                                      | Retain the existing save protection                                                                            |
| Write protection               | Revoke stale feedback and submitted snapshots                                                                        | Cancel autosave scheduling                                                                                     |
| Disposal                       | Revoke feedback and capabilities                                                                                     | Reject new work; drain already-submitted saves                                                                 |

The persistence interruption subscription distinguishes storage pause, failure,
deletion, write protection and committed restores.

Completed actions survive process termination after local acknowledgement. This
promise does not cover power loss, subsequent filesystem failure, or browser eviction.

Local acknowledgement and Cloud mirroring are separate. The
[storage contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#write-acknowledgement)
owns operation lanes, fallback writes, exit flushing and deletion ordering.

## Persistence API

The [persistence ownership map](./ARCHITECTURE.md#persistence-ownership) separates schemas and repair, session codecs, and storage transport. `shared/stores/persistence/settings-codec.ts` owns settings field selection and hydration; `shared/stores/session/settings-state.ts` owns live settings and notifications.

`buildAlchemySaveDataFromStores(session)` owns complete snapshot construction.
It derives the active activity and permanent fields from the current session,
then detaches the whole payload; callers cannot supply a stale run or omit a
live one. `SessionSaveSnapshots` owns session-local snapshot provenance and submission
ordering; `ProgressCompletion` owns player-action acknowledgement. The shared
`io.ts` seam admits only unchanged snapshots captured by that session. Imported
or externally constructed payloads must go through restore, then snapshot; they
cannot write over a live career directly. Autosave, Gear flushes, run-end flushes,
and exit saves use that same boundary.

### Snapshot admission

A snapshot can be written through another adapter for the same session. Each
receipt binds its contents, career generation, gameplay revision, and capture
sequence. Capture sequence orders settings-only snapshots as well as gameplay.
A submission older than the newest admitted snapshot returns `superseded` without
writing; a snapshot retained across restore, clear, backend replacement, or write
protection returns `skipped`. Foreign or edited payloads return `failed` before
storage. Validation runs both at admission and inside the storage lane, so queued
snapshots cannot revive a replaced career. An already executing backend write
cannot be recalled; replacement saves follow it through the serialized lane.

Storage submission outcomes follow [write acknowledgement](../src/features/alchemy/shared/storage/MIGRATIONS.md#write-acknowledgement).
Supersession neither clears a storage failure nor reports a new one. Detaching an
autosave owner releases only its scheduling and retry registration; pending session
feedback survives until a covering save or invalidation. Disposal revokes feedback
but drains authorized exit writes. Receipts are runtime-only. Low-level transport
tests exercise arbitrary payloads below this session boundary.

### Acknowledged feedback

Acknowledged feedback has one session-owned FIFO delivery queue. A covering save
reserves its batch before publishing idle, so idle observers and nested saves
cannot deliver newer navigation or feedback ahead of older callbacks. Delivery
rechecks the save gate before each callback; a new checkpoint started by feedback
or an idle observer pauses the remaining queue until that checkpoint is saved.
Restore,
clear, protection, and disposal revoke undelivered callbacks, including callbacks
registered reentrantly while the queue is draining. Feedback failures are isolated.

### Codecs and restore

`run-resume-codec.ts` translates the active-run progress and session fields to and from `ActiveRunData`. The encoder selects
progress, mode geography, and one tagged `activity`; the decoder hydrates that
branch and derives its route directly. Retired screen/visit/reward shapes are
rejected before validation. `run-restore.ts` applies the decoded
fields and explicit current-data repairs in the command draft.

`run-lifecycle.ts` exposes `snapshotRun(session)`, `restoreRun(…)` for run-only
restoration, and `restoreSessionSave(save, session, options)` for complete saves.
Bootstrap, independent session initialization, and playthrough fixtures use the
complete-save command: profile, Gear, permanent progress, codec repairs, active
run decoding, battle rebinding, and incompatible-battle settlement share one
draft and one gameplay revision. Settings remain a separate store; their codec
prepares normalized values without mutation, then installs them during the same
publication boundary. Gameplay, settings, and progress observers therefore read
the complete replacement, never a mixture of careers. A preparation or decoding
failure changes neither state nor pending save protection. Abandonment feedback
and its immediate save follow publication of the complete replacement.
Repeated bootstrap may preserve an initialized activity while applying saved
progression and rebinding its live manifests in the same command.
`persistence-hydration.ts` composes the gameplay codec repairs inside that draft;
`hydrateAlchemyPersistenceFields` remains the fields-only operation and does not
restore an activity. Both paths include Trinket-manifest repair. `parseActiveRun(raw)` validates JSON before hydration; `toActiveRunData` in `lib/validation/parse-active-run.ts` handles run parsing, while `PersistedBattleStateSchema` owns battle wire parsing and default merging.

Domain persistence codecs own field selection, defaults, encoding, hydration, and subscriptions. `GameplayPersistenceCodec<T>` receives a `GameplayDraft`; `StandalonePersistenceCodec<T>` owns a separate Zustand store. `shared/storage/persistence.ts` composes their fields into the versioned envelope and subscribes to settings changes plus the gameplay commit signal. Codec types live in `shared/stores/persistence/persistence-codec.ts`.

The settings store defers hydration notifications until the coordinator arms save
protection; subscriber failures are isolated so they cannot interrupt publication.
Live settings changes advance the durability checkpoint before notifying observers
when progress tracking is active or a save is already pending. Settings do not
advance the gameplay revision, so an older snapshot of that revision cannot
acknowledge the newer settings. Unchanged setters do not advance the checkpoint;
hydration uses the coordinator's replacement epoch instead.
Persistence subscriptions compare both owners against one baseline, producing
one complete snapshot when restore changes both. Fields-only hydration uses the
same publication boundary while retaining the current activity. Restore publishes
its new persistence generation even if the saved values are equal; the gameplay
root and revision remain unchanged when no gameplay field changes.

### Change detection

`shared/stores/persistence/run-resume-codec.ts` owns `projectRunResumeSnapshot`, the single
projection used by both run encoding and persistence change detection. The
projection selects the current activity's wire fields and mode-specific data;
inactive runs project to null. `persistence-commit-filter.ts` compares those
projections structurally, skipping shared immutable branches by identity. Claim
locks, presentation navigation, destination-only reward leftovers, and battle
metrics cannot trigger autosave or arm the progress gate. Adding a field to the
wire projection automatically includes it in change detection. Permanent progress
uses the save keys from `run-profile-save-fields.ts`, excluding derived Homestead
effects; profile, settings, and Gear retain their own save fields.

Projection can describe an incomplete `idle` or Mystery activity during command
construction without throwing. Strict run encoding still rejects either until
its resumable activity is complete. The save builder reads the gameplay aggregate
directly and detaches the complete save once; it does not construct screen or
battle display data to persist a run.

### Storage and resumable activity

| Storage responsibility                                     | Owner under `shared/storage/` |
| ---------------------------------------------------------- | ----------------------------- |
| Candidate parsing, selection and future-version protection | `save-candidates.ts`          |
| Backend, serialized operation queue and slot protection    | `save-storage.ts`             |
| Session snapshot admission and acknowledgement             | `io.ts`, `save-io.ts`         |
| Bound feature-facing persistence capabilities              | `session-persistence.ts`      |

`src/lib/platform-save-backend.ts` owns browser/desktop transport. `initializeSteam()`
returns capabilities rather than mutating platform state. Configure a backend only
while storage is idle; submitted work cannot switch transports. Captured backend
methods retain their original receiver. Independent sessions configure their own
backend; only the application adapter preserves the platform/SSR defaults.

The [public save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract)
owns candidate precedence, local/Cloud policy, queues, acknowledgement and deletion.
Load status is diagnostic; failures recover to playable data or defaults without a
save-problem screen. Storage drain includes published write outcomes and progress
receipts, including immediate writes without an awaiting caller.

Save snapshots are detached from live state; read ports borrow immutable committed
values as described under [Run state](#run-state). Restoring active combat returns
to battle before considering the mode map or destination route.

`session.activity` owns one logical location and its visit. Mode geography remains
run-wide; the reward-flow working state spans commands, but only the selected
activity's reward/destination payload is serialized. Presentation navigation and
Menu/meta visits never replace activity. Commands establish a durable next
activity before animation starts. `idle` is construction-only and cannot be
saved as an active run. The version 21 wire union contains battle, reward,
destination, visit, drafting, difficulty, map, and Wildwood-removal branches.
Inactive state writes no active run. A malformed selected activity cannot silently
be replaced by another stale visit; unusable run structure preserves permanent
progress while dropping that run. A damaged Mystery offer retains its known tag
until the current restore command exits the unusable visit.

Reward grants and bundle advancement follow [Activity and rewards](./RUN_STATE.md#activity-and-rewards); mode selection and resume follow [Run setup ownership](./ARCHITECTURE.md#run-setup-ownership).

[Reset Homestead](./TALENT_RULES.md#reset-homestead) follows the same session-bound
command and live meta-rebinding boundary.

The permanent purse owns Gold. Live battle commands reconcile the engine output delta against that purse in the same transaction. Purse writes update the current battle input. Battle restore hydrates and rebinds the committed snapshot without executing gameplay. Retired legacy input/result pairs never reconcile uncommitted earnings. Run Health is carried between battles; the battle snapshot owns combat Health until run settlement, while live meta rebinding updates the shared maximum and clamps current Health.

- **Autosave scheduling:** `app/autosave-scheduler.ts` owns revision acknowledgement, cancellation epochs, maximum wait, retry decisions, and the exit-once latch for one subscription lifetime. Its factory is the only scheduling API; submission and completion update the same private state, and tests exercise save sequences through that API. The shared `app/autosave-lifecycle.ts` supplies subscriptions, debounce selection, snapshots, completion gating, and storage writes with an injectable clock/timer seam. The React adapter supplies lifecycle events; the headless runner uses the same lifecycle without mounting React. Explicitly configured save backends also run outside a browser; unconfigured SSR retains its no-storage behavior. Late completions from cancelled epochs cannot acknowledge new progress. `SaveOperationQueue.storageEpoch` separately guards storage invalidation (clear/protection/reset) for all queue writers, including non-scheduler fast paths.

Run recap tracking belongs to active-run progress: chronological visits and earned
Gold persist through the existing resume codec. Room entry/completion and Gold grants
use the write port; battle-to-purse commits count only newly earned Gold, never purse
mirror synchronization. Run finalization captures a detached `runRecap` (history,
ending and room identity, deck, Boons, earned Gold) before making activity inactive. Completion and the ending marker resolve the current visit by identity, since an unresolved room can be revisited after later history entries. The screen-data
capability supplies the recap; card inspection selects its deck on ending screens.
The recap is transient, survives voluntary teardown, and clears on a fresh run.

## Session capability ports

Bind capabilities once to an explicit session at controller composition. Under
`shared/stores/`, domain reads and runtime internals live in `session/`, React
adapters in `react/`, intent commands and writes in `commands/`, and codecs in
`persistence/`. [Session ownership](#session-ownership) governs binding and disposal.

| Consumer need                             | Entry point                                                                    | Contract                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Committed gameplay reads                  | `session/run-reads.ts`                                                         | Data-only active-run, profile, session, battle and shop views                                              |
| React gameplay reads                      | `react/use-run-reads.ts`, `use-gear-store.ts`, `use-profile-store.ts`          | Narrow session-bound slices; no internal store access                                                      |
| Screen display                            | `session/run-screen-data.ts`, `react/use-run-screen-data.ts`                   | Selectors derive `RunScreenDataByScreen`; routes retain outgoing data through fades                        |
| Command dispatch and domain writes        | `commands/run-session-command.ts`, `run-session-write-port.ts`                 | [Atomicity](#command-atomicity), readonly transactions and detached results                                |
| Card, Wish and turn actions               | `commands/battle-commands.ts`                                                  | [Committed playback](#committed-battle-playback) and [input identity](./BATTLE_CONTROLLERS.md#battle-path) |
| Standalone battle starts                  | `commands/battle-start-commands.ts`                                            | Room entry composes the same private initialization operation                                              |
| Gear player actions                       | `commands/gear-commands.ts`                                                    | [Armory write paths](./ARMORY.md#write-paths)                                                              |
| Snapshot, restore, save and retry         | `shared/storage/session-persistence.ts`                                        | [Persistence API](#persistence-api) and [local saving](#completed-actions-and-local-saving)                |
| Run lifecycle                             | `commands/run-lifecycle.ts`                                                    | [Teardown and settlement](./RUN_WORKFLOWS.md#run-teardown)                                                 |
| Settings and meta intents                 | `session/settings-store.ts`, `commands/meta-commands.ts`                       | Named actions; raw hydration/replacement stays private                                                     |
| Route actions and shop/battle composition | `shell/use-alchemy-run-controller.ts`, `shell/route-commands.ts`               | Signatures derive from factories; routes borrow only their phase's authority                               |
| Navigation and outcomes                   | `shell/run-flow-engine.ts`, `run-loop/run/run-flow.ts`                         | [Controller navigation timing](./BATTLE_CONTROLLERS.md#navigation-timing)                                  |
| Room entry and destination sampling       | `run-loop/run/room-entry-commands.ts`, `commands/destination-offer-command.ts` | [Activity ownership](#activity-and-rewards) and [run setup](./ARCHITECTURE.md#run-setup-ownership)         |

Unprefixed entries are relative to `shared/stores/`; `shell/`, `run-loop/` and
`shared/storage/` are relative to `src/features/alchemy/`.
`run-session-write-port.ts` is the public write import; domain implementations stay
behind it in `commands/write/`. Feature adapters call intent commands, while command
owners compose write-port operations in their open transaction.

Screen routes own display hooks. Battle uses `useBattleScreenRouteData` and route
playback rather than controller display re-exports; ending screens inspect the
captured recap after activity becomes inactive. App chrome, autosave and particles
also use capability hooks. Imperative handlers read their lifetime-bound ports when
called. Transient UI may use `ui-store`.

Reward route actions accept `claimChoice(id)` or `skip()`. The command validates the
live offer and finalizes it behind the claim guard. Card Skip ignores legacy
`selectedId`; saved selection no longer drives interaction. Battle routes exclude
startup and cancellation authority. Room presentation takes navigation and detached
opening feedback, never gameplay callbacks or draft access.

Boot restores the complete save through `SessionPersistence.restore` before
publishing readiness. Steam initialization configures the backend before loading
candidates. See [boot](./ARCHITECTURE.md#boot-and-loading) for application composition.

## Card inspection and combat equipment reservations

Card inspection (`cardInspection: null | "deck" | "draw" | "discard"`, mutually exclusive with `enemyInspectionOpen`) plus hover, autoplay preview, shimmer, and plasma registrations live in `ui-store`.
`useCardInspectionData` / `readCardInspectionData` expose the current run deck and
resolved battle collections through capability reads. App orchestration owns
visibility and transient focus, screen chrome carries the header action, and
battle pile actions travel through route/screen props. The shared overlay is
controlled and never reads gameplay stores. Manual battle input and automatic
playback recheck the UI gate at execution time.

Gear commands and Armory presentation share the derived combat reservation
policy from `gear-combat-restrictions.ts`, exposed by the Gear read owner. The
policy covers the sole active battle, including while visiting meta screens. It protects reserved loadouts and item mutations before any
resource or health changes. [ARMORY](./ARMORY.md#combat-equipment-restrictions)
owns the player-facing restriction; existing Talent/Homestead rebinding remains.
