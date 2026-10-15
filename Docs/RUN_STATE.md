# Run state and persistence

## Run state

Each game session owns one authoritative nested gameplay aggregate constructed in `shared/stores/gameplay-state.ts`. `gameplay-state-reads.ts` owns explicit-session aggregate reads and subscriptions; `session-gameplay-store.ts` owns a cached presentation read store per session; `gameplay-state-store.ts` is the default-application adapter. Reusable reads, commands, and persistence codecs do not import React or initialize the application. Its `run`, `session`, `runProfile`, `profile`, and `gear` objects are the domain-shaped state, and the aggregate is data-only: draft mutators in `run-session-write-port.ts` (plus `homestead-actions.ts` / `gear-actions.ts`) compose atomic changes. Feature commands receive a deeply readonly `RunTransaction`, with live reads of the same draft. Only store-owned mutation implementations and bootstrap hydration receive the raw `GameplayDraft`; feature commands cannot assign fields or mutate nested collections directly. Feature orchestration should call intent-level commands rather than assemble field updates. `profile-store.ts` and `gear-store.ts` are thin aggregate-backed read/persistence modules; React profile slices live in `use-profile-store.ts`; they do not own shadow state. The write module, reads, commands, and `run-lifecycle.ts` are the feature-facing seams. Independent runtimes follow [Session ownership](#session-ownership).

Committed gameplay is immutable in every build. `createGameplayStore` freezes the
complete initial aggregate and each new revision before save-status or gameplay
observers run. Read ports borrow those stable references; reads never freeze or
copy live state as a side effect. Projection wrappers may be changed locally,
but their nested gameplay values remain protected. Commands use Immer drafts;
input ownership and detached command results stay at the transaction boundary.
Freezing caches fully traversed objects, so later revisions traverse only changed
branches and retain structural sharing. Publication validates the changed graph
before freezing: gameplay accepts plain records and arrays, never functions,
accessors, or built-ins with mutable internal slots such as Map and Date.
Detached command results retain their broader supported data types; they do not
become gameplay state. Settings and progress-status snapshots are also frozen,
so borrowed reads cannot bypass their notification and persistence paths.

| Aggregate region | Concern                                                                                                                                                                                                                                      | Lifetime                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `run`            | Deck, HP, acts, run Boons on `run.activeRun`; presentation screen on `run.navigation`; one resumable active run                                                                                                                              | Resets on run termination                                                                                          |
| `session`        | One active activity/visit, rewards, labyrinth progress, pending selections, and run-flow claims                                                                                                                                              | Per live run; active visits persist via the resume codec; the run’s reward bundles persist in `activeRun.activity` |
| `runProfile`     | Homestead (buildings/farms/research/companions), talent XP / unlocks, derived `effects`, and the shared gold purse — persisted as flat top-level save fields via `run-profile-codec` codec                                                   | Profile lifetime                                                                                                   |
| `profile`        | Collection discoveries, collected boards / cosmetic selection / resolved background / pending reveal, completed difficulties, and finished-run character unlocks; collection tab/page UI is transient in-memory, outside `ProfileSaveFields` | Profile lifetime                                                                                                   |
| `gear`           | Permanent inventories, loadouts, and crafting currencies                                                                                                                                                                                     | Profile lifetime                                                                                                   |

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
never gameplay command inputs or resume data. Menu and meta navigation remain
independent of activity, so an unfinished battle stays resumable there.

Live reads and screen data expose `runProfile.gold` as `gold`. `profile` never owns gameplay currency. Homestead and talent mutations rebind live Health and battle manifests through the owning command. Battle VFX live separately in `run-loop/battle/` (state in `battle-presentation-store.ts`, overlays in `presentation/` leaves) and are not persisted.

### Command atomicity

Gameplay mutation callers enter through `dispatchRunSessionCommand()` from
`run-session-command.ts`. The boundary opens one Immer draft of the authoritative
aggregate and publishes a new root with one incremented revision when state
changes. Every command returns an explicit `CommandOutcome` using `acceptCommand(value)`
or `rejectCommand(reason, fallback)`. Rejection discards all draft changes, including RNG
counters, preserves the root and revision, and emits no commit signal. Unchanged accepted
commands also preserve the root and revision; thrown execution errors discard the draft.
The dispatcher returns the outcome's value so route-facing result shapes stay unchanged.
React selectors and autosave subscribe to
that same root. Settings and presentation-only state remain separate.

Store-owned restore commands also stage settings normalization before execution.
After acceptance, the dispatcher installs gameplay and settings, replaces the
save acknowledgment epoch, and arms any pending save protection before notifying
observers. Decoding, settings preparation, rejection, or result-validation failure
leaves both stores, the pending save gate, and completion callbacks unchanged.
Ordinary feature commands cannot request this restore publication mode.

Run-profile codecs detach persisted collections on both encode and hydration;
run restoration owns the entire active-run graph before decoding or rebinding.
Restoring never freezes or mutates a caller's save, including nested battle and
visit data. `snapshotRun()` returns detached data just like the complete session
save builder; internal resume projections may still borrow immutable branches.

The aggregate exposes read/subscription capabilities separately from its internal
commit capability; React adapters and test fixtures cannot bypass commands through
`setState`. The coordinator installs the complete root, arms its persistence and
presentation gate, then notifies gameplay subscribers. Save-status subscribers
therefore see the revision they are being asked to save. Gameplay subscriber
failures are logged independently and cannot suppress later subscribers, autosave,
or command completion effects. Subscription changes during gameplay notification
apply to the next publication. `notification-channel.ts` owns synchronous FIFO
delivery for gameplay, settings, progress, save status, storage interruptions, and lifecycle
channels. Each publication captures its listeners; observer-triggered publications
wait until the current event reaches every observer. Session-owned channels check
their lifetime before each callback: disposal stops the remaining captured
listeners and queued publications immediately. Ordinary unsubscribe retains the
current publication's listener snapshot. Listener failures are isolated
through the channel owner's diagnostic handler. Execution failures still roll back; explicit
`afterCommit` failures still propagate after the committed state is retained.

Gameplay and save-status observers run during command publication while the
command guard is still held. They may read the installed revision, but must not
dispatch another gameplay command. Put command follow-ups in `afterCommit` or
after the original dispatcher returns, when the guard has been released.

Domain operations receive the transaction explicitly and compose inside one command;
a command body must not call another command. Transactional checks that guard
a write (shop Gold, refresh counts, purchased slots) read from that draft rather
than a committed read port. The read view updates as operations write, and both TypeScript and runtime guards reject direct writes. Functional setter updaters also receive deeply readonly previous values; return the replacement rather than mutating the previous value. Validate before writing when possible; a later rejection still
rolls back the complete transaction. Raw values are not valid command outcomes.
Acceptance is independent of the payload: `acceptCommand(false)` can represent a
successful act advancement, while `rejectCommand(reason, false)` rejects an action.
Destination-claim cleanup can likewise accept a `false` result after cancelling an
obsolete claim. Shop adapters translate `committed: false` into rejection; Gear
adapters translate their operation failure results (`false` and `null`) into rejection.
Persistence adapters may subscribe to the aggregate
commit signal directly; gameplay callers must not.

`run-session-write-port.ts` adapts the existing domain mutators to transactions; it does not own a second store. Raw dispatch (`gameplay-command.ts`), draft lookup (`transaction-internal.ts`), and read-facade internals are restricted by import boundaries. A transaction can write only during its callback; retained handles cannot write in `afterCommit` or another command. `snapshotTransactionValue(value)` returns a detached value for engine APIs that require mutable types. The aggregate dispatcher detaches result data before Immer closes the draft, for both store-owned and feature commands. Accepted results and rejected fallbacks may contain nested draft reads or read facades; neither escapes into deferred playback. Result objects are independent of committed state, preserve aliases and cycles, and the same detached result reaches `afterCommit` and the caller. Wrappers do not perform their own result conversion.

`boundary-data.ts` owns one graph traversal for setter inputs, explicit transaction
snapshots, and command results. Supported objects are plain records (including
null-prototype records), arrays, Maps, Sets, Dates, and RegExps. Aliases and cycles
are preserved across container entries and all own data properties, including
non-enumerable and symbol-keyed metadata. Dates retain their timestamp; RegExps
retain their pattern, flags, and `lastIndex`. Other prototypes and accessor
properties reject before publication rather than being silently flattened by a
fallback clone. Caller-owned setter inputs are detached; existing transaction
reads retain their owned source. Explicit snapshots and results always detach.

Command results are detached data, including nested arrays, Maps, and Sets.
Functions and Promise-like values cannot cross this boundary, even inside a
rejected fallback. Invalid results abort before state, revision, RNG counters,
or observers publish. Command result types enforce the same rule for known
types; the runtime boundary also checks untyped inputs.

Transaction-provided RNG and instance-ID functions are execution capabilities.
They are bound to the originating open draft and reject use after it closes,
including during a later command in the same session. Retaining a callback in
an external closure does not extend its lifetime.

Commands are synchronous and must not span an `await`. The command factory and
Gear mutation wrappers reject Promise-like result types, including unions with
asynchronous results. The runtime boundary also rejects thenables before
publication, preserving the root, revision, and RNG counters. Rejected
asynchronous continuations are observed to avoid an additional unhandled
rejection; the boundary cannot cancel external work already started by an
invalid callback.

Every write-port operation invalidates its owning command through
`abortGameplayCommand` if input preparation, an updater, or mutation throws.
The same rule covers Gear's coupled mutation and Health rebinding scope.
The coordinator retains the first failure until the draft closes: catching it
inside an enclosing recipe cannot publish partial activity, payments, or RNG
changes. Rejection values remain available for expected validation failures;
exceptions abort the complete command. This failure state belongs to that command only.

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
`shared/stores/session-effects.ts` isolates each audio/UI adapter and lifecycle
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
Defeat's optional `clearCombatPresentation` callback remains an additional adapter.

### Committed battle playback

Battle reads expose serializable `BattleSnapshot` values. Opening draws and card
plays commit before presentation. `commitEndTurn` resolves the turn and its
Companion follow-up with the engine-owned `resolveBattleAction` end-turn request,
awards Dodge XP only after acceptance, and publishes the result atomically before
discard or enemy animation.

`BattleState` is the engine's execution shape, which may carry RNG and action
callbacks. Use `battleSnapshot(state)` when converting engine or fixture state
to committed data; a type assertion does not remove executable fields. The
helper strips execution metadata without drawing RNG or resolving gameplay.

Playback consumes detached `BattleTurnFrame` values and updates only
`battle-presentation-store.displayedBattle`; cancellation or failed animation
cannot roll back or advance gameplay. Inside store-owned battle commands, narrow
`draft.session.activity.kind` to `"battle"` and pass
`current(draft.session.activity.data.battleState)` to the resolver so no revoked
Immer proxy can escape. Feature callers consume the detached command result
through battle capabilities rather than accessing the raw draft.

An active terminal battle remains serializable until its outcome settles. Current
saves contain one committed battle snapshot in `activeRun.activity`. Versions
19/20 convert their activity fields once during migration. Unfinished legacy
battles produce a load-only abandonment instruction for the selected candidate;
restore settles earned progress with today's abandonment command before showing
End Run. No obsolete turn, Companion action, Gold delta, or RNG draw is replayed.
The same recovery applies to a nonterminal current snapshot marked as an enemy
turn: current turn resolution commits atomically, so no resumable enemy phase
exists. Terminal snapshots retain their normal outcome settlement.
`playerDodgeCount` and `dodgeChanceFromDamage` remain battle-owned and persist.
The Health-damage boundary requires explicit `hostile` or `self` provenance for
Finding Rhythm; Health costs do not award it.

## Session ownership

`shared/stores/game-session.ts` exposes `createGameSession({ initialSave, saveBackend, runtimeInputs })`.
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

`await session.dispose()` removes subscriptions, cancels autosave/navigation work,
clears lifecycle channels, drains already-submitted saves, and disables further
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

## Activity and rewards

Campaign and Labyrinth room entry use `enterRunRoom` in
`run-loop/run/room-entry-commands.ts`. Its typed request selects an offered
Campaign destination or the selected reachable Labyrinth node. Validation,
activity initialization, encounter traits, history/progression, and seeded RNG
commit together. Rejection and initialization errors preserve the previous root
and revision. The returned screen and detached opening battle feedback contain
no gameplay mutation callbacks; shell navigation and feedback run after entry.
A presentation error does not undo accepted room entry. Save wire fields and
resume decoding remain unchanged. `room-visit-initialization.ts` supplies the
transaction-only visit recipes to that owner. Screen and shop command contracts
expose player actions without initialization. Rendering, remounting, and presenting
Mystery never sample visit RNG or replace committed activity.

`session.activity.kind === "inactive"` is the sole stored marker for an inactive run. Active runs may have `idle` while being prepared; meta screens preserve the current activity. Read ports derive `hasActiveRun`; it is not a second stored boolean. `session.rewardFlow` owns the current reward bundle, Companion cards, and one claim union (`idle`, `reward`, or `destination` with its destination). Reward and destination claims cannot both be active. The visible navigation screen remains independent so menus and fades do not redefine the resume location. Save codecs retain the existing wire fields.

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
`SessionPersistence` exposes `checkpoint`, `readProgress`, `subscribeProgress`,
`trackProgress`, `retryProgress`, and `afterProgressSaved`. A checkpoint carries
the gameplay revision and a runtime epoch; only a covering local write in that
epoch acknowledges completion. The save envelope does not gain scheduling data.
Pending acknowledgements, deferred feedback, and storage cancellation belong to
the session, independently of autosave subscription lifetimes. `trackProgress`
registers a retry driver with its own idempotent release; the newest live driver
handles Retry, falling back to the preceding driver when released. Releasing a
driver cannot cancel another driver's registration or acknowledge unsaved work.
A replacement durable autosave driver schedules the session's pending revision
without requiring another gameplay action. With no driver, pending state and
pre-action display remain protected; explicit Retry can checkpoint directly.

Completion feedback uses one session-owned FIFO. New feedback registered during
a callback joins its tail. Before each callback the owner rechecks save protection:
if an earlier callback or save-status observer starts another checkpoint, the
remaining feedback waits for that checkpoint. Restore, deletion, write protection,
and disposal can still discard the queued work. Feedback exceptions are logged
without suppressing later callbacks, including when no save is pending.

Player-facing store hooks retain the immutable pre-action progress until saving
succeeds. Transient navigation, Collection browsing, and inspection remain usable.
Domain reads continue to see the committed state. Player command entrypoints reject
additional progression while saving or after failure; internal combat and terminal
settlement commands still resolve synchronously. The renderer groups synchronous
commits into one immediate checkpoint rather than waiting for the ordinary autosave
debounce. Presentation and local saving must both settle before another action.

A failed primary write tries the recovery slot. If both fail, show “Couldn’t save”
and Retry; keep the original action pending and retry its snapshot without repeating
costs, rewards, or RNG. The existing autosave timer handles automatic retries.
Explicit Retry bypasses backoff once; repeated activation during saving does nothing.
Successful clear, successful restore, write protection, and disposal invalidate pending completion callbacks.
Explicit checkpoints establish a new acknowledgement requirement even when the
gameplay revision is unchanged, including settings-only changes. Snapshot tokens
carry that checkpoint version as well as the gameplay revision; an older write
can finish successfully without releasing a newer checkpoint's gate or feedback.
Requesting deletion pauses autosave and revokes submitted snapshots immediately,
while retaining the pending action, pre-action display, and completion callbacks.
If deletion fails, that action remains protected and retryable; autosave resumes
with a fresh snapshot of the current career, including settings-only changes.
Only successful deletion discards the paused work. Overlapping clears keep writes
paused until all finish; any successful deletion discards the old work.
Restore replaces the acknowledgment epoch only at commit and keeps save protection
armed continuously until the replacement snapshot is saved. A failed restore retains
the previous epoch, pending action, and deferred feedback. Successful restore also
invalidates autosave scheduling before observers schedule replacement work, so a
late pre-restore write cannot cancel replacement retries. The session persistence
interruption subscription distinguishes storage pause, failure, deletion, write
protection, and committed restores. A newly attached autosave client reads the
current deletion gate before scheduling work.
Completed actions survive process termination after local acknowledgement. This
promise does not cover power loss, subsequent filesystem failure, or browser eviction.

Steam Cloud mirrors serialize independently and coalesce queued payloads per slot.
Local acknowledgement does not wait for Cloud. Desktop adapters sharing the same
IPC endpoint also share a physical operation lane in `platform-save-backend.ts`.
Reads, local writes, deletes, and demo initialization receipt operations follow
submission order across adapters; failure cannot poison the lane. A later save
cannot acknowledge files while an earlier delete can still erase them. Deletion discards queued uploads and
drains an in-flight upload before removing mirrors so it cannot resurrect a save.
`desktop/steam-cloud-storage.cjs` owns the process-wide Cloud operation lane across
both slots. Reads, uploads, and deletion share that lane even when their originating
renderer has been replaced; renderer-local mirror scheduling cannot provide this
ordering on its own. Cloud request failures release the lane for subsequent work.

## Persistence API

`buildAlchemySaveDataFromStores(session)` owns complete snapshot construction.
It derives the active activity and permanent fields from the current session,
then detaches the whole payload; callers cannot supply a stale run or omit a
live one. `SessionSaveSnapshots` owns session-local snapshot provenance and submission
ordering; `ProgressCompletion` owns player-action acknowledgement. The shared
`io.ts` seam admits only unchanged snapshots captured by that session. Imported
or externally constructed payloads must go through restore, then snapshot; they
cannot write over a live career directly. Autosave, Gear flushes, run-end flushes,
and exit saves use that same boundary.

A snapshot can be written through another adapter for the same session. Each
receipt binds its contents, career generation, gameplay revision, and capture
sequence. Capture sequence orders settings-only snapshots as well as gameplay.
A submission older than the newest admitted snapshot returns `superseded` without
writing; a snapshot retained across restore, clear, backend replacement, or write
protection returns `skipped`. Foreign or edited payloads return `failed` before
storage. Validation runs both at admission and inside the storage lane, so queued
snapshots cannot revive a replaced career. An already executing backend write
cannot be recalled; replacement saves follow it through the serialized lane.

Each queued submission owns its completion. A coalesced-away submission returns
`superseded`, never the replacement payload's outcome. Autosave retains unsaved
work for retry; supersession neither clears an existing storage failure nor
reports a new one. Only an actually written, current snapshot can acknowledge
its captured revision. Detaching an autosave owner releases only its scheduling
and retry registration; pending session feedback survives until a covering save
or explicit invalidation. Disposing the session cancels feedback acknowledgement
but still drains authorized exit writes. Save receipts never enter the wire format.
Low-level transport tests use the storage runtime directly to exercise arbitrary payloads below this session boundary.

Acknowledged feedback has one session-owned FIFO delivery queue. A covering save
reserves its batch before publishing idle, so idle observers and nested saves
cannot deliver newer navigation or feedback ahead of older callbacks. Restore,
clear, protection, and disposal revoke undelivered callbacks, including callbacks
registered reentrantly while the queue is draining. Feedback failures are isolated.

Explicit retry captures the pending career and checkpoint before notifying status
observers, then selects the latest attached retry driver. Replacement or cancellation
during notification revokes that request. If its driver detaches or throws before
starting a save, the session persistence port performs a fresh checkpoint instead;
retry never repeats the gameplay action or leaves saving dependent on a departed owner.

`run-resume-codec.ts` translates the active-run progress and session fields to and from `ActiveRunData`. The encoder selects
progress, mode geography, and one tagged `activity`; the decoder hydrates that
branch and derives its route directly. Historical screen/visit/reward precedence
exists only in the version 20-to-21 migration. `run-restore.ts` applies the decoded
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

Domain persistence codecs own field selection, defaults, encoding, hydration, and subscriptions. `GameplayPersistenceCodec<T>` receives a `GameplayDraft`; `StandalonePersistenceCodec<T>` owns a separate Zustand store. `shared/storage/persistence.ts` composes their fields into the versioned envelope and subscribes to settings changes plus the gameplay commit signal. Codec types live in `shared/stores/persistence-codec.ts`.

The settings store defers hydration notifications until the coordinator arms save
protection; subscriber failures are isolated so they cannot interrupt publication.
Persistence subscriptions compare both owners against one baseline, producing
one complete snapshot when restore changes both. Fields-only hydration uses the
same publication boundary while retaining the current activity. Restore publishes
its new persistence generation even if the saved values are equal; the gameplay
root and revision remain unchanged when no gameplay field changes.

`shared/stores/run-resume-codec.ts` owns `projectRunResumeSnapshot`, the single
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

`shared/storage/save-candidates.ts` owns save parsing, validation, and future-version protection (deterministic `evaluateSaveCandidates`, for testability); `shared/storage/save-storage.ts` owns each storage instance’s backend, queue, write protection, and load/write/exit/clear operations. `shared/storage/io.ts` preserves the app function API over the selected session’s IO instance and owns the unconfigured storage guard. The application adapter preserves the SSR guard. Backend configuration is allowed only while loads, writes, and clears are idle, so submitted work cannot move to a different transport. Bootstrap configures the application instance; each headless career configures its own instance; isolated tests can construct `SaveStorage` directly. The queue is private to its storage owner. `src/lib/platform-save-backend.ts` owns browser/desktop transport, backup/cloud candidate order, and recoverable write/clear ordering. `initializeSteam()` returns an explicit `cloudSyncEnabled` capability; it does not mutate shared platform state. Candidate order, Steam Cloud as a one-way mirror, and wipe/protect behavior: [MIGRATIONS.md § Public save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract).

`desktop/save-storage.cjs` owns a second, process-wide lane for native profile
files. IPC ring reads, writes, deletion, and demo-initialization receipt work
serialize there across renderer replacement and independent session queues.
Deletion waits for earlier writes, subsequent reads see complete ring rotation,
and an operation failure does not poison later storage work.

`SaveOperationQueue` serializes loads, writes, and clears; a load seals pending save coalescing, observes preceding writes, and establishes slot protection before following writes. Demo initialization writes inside its load operation, so a later clear cannot be overtaken by import. Exit writes use the synchronous path only when no load or clear is pending; otherwise they follow the queue's protection and cancellation rules. Loads and successful clears may resume writes only if no newer explicit write-permission decision has occurred since submission; recovery-slot selection does not itself grant permission. Draining storage includes pending loads and their initialization writes. `save-io.ts` also drains published write outcomes, including failure status and session progress receipts, so transport completion cannot outrun acknowledgement.

The storage owner reads primary and recovery slots before selecting the freshest playable save. Selection also determines the permitted write attempts; a failed primary write only tries recovery when compatibility allows it. Unreadable or newer-format data stays in its slot under the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract), which owns the exact fallback and wipe rules. Load status is diagnostic only, so the app continues into play without a save-problem screen.

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

Reset Homestead is a session-bound meta intent command. One transaction sums
current catalog costs for purchased Building, Farm, Research, and Companion tiers,
refunds the stockpile, clears those levels to defaults, and recomputes/rebinds live
meta effects. Empty resets reject without a revision or refund. Refunds bypass
find bonuses and run-earned/recap tallies. Discoveries, Gold, RNG, and resolved
combat grants remain intact; existing maximum-Health rebinding clamps Health.

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

Use this reference for access and orchestration; unprefixed store filenames are under `shared/stores/`.

- **Committed reads** — `run-reads.ts`: data-only `readActiveRun`, `readRunProfile`, `readRunSession`, `readBattle`, and shop reads. React hooks in `use-run-reads.ts` provide the derived run phase and narrow Homestead, talent, and battle reads; `useActiveRunScreenValue` reads the presentation screen.
- **Screen display** — `run-screen-data.ts` owns the exact selectors and derives `RunScreenDataByScreen` from their return types; `useRunScreenData(screen)` in `use-run-screen-data.ts` subscribes once per route and retains its last active data during fades. Visit hooks follow activity; run recaps follow the visible ending screen because settlement makes activity inactive. Battle uses `app/screen-routes/use-battle-screen-route-data.ts`, composing `useRunSessionBattleContext` for display, never shell command inputs.
- **Commands and writes** — `run-session-command.ts` owns dispatch and `createRunSessionCommand` bindings. `run-session-write-port.ts` exposes domain operations with `RunTransaction` as their first argument; `set*` accepts a value or readonly updater. The internal `gameplay-command.ts` retains the single draft/commit coordinator. There is one import path for writes; implementations are split by domain under `shared/stores/write/` behind that barrel.
- **Battle commands** — `battle-commands.ts` owns card play, Wish selection, and turn completion; `battle-start-commands.ts` owns standalone validated starts; room entry composes the same `initializeBattle` transaction operation. Its `presentBattleStart` callback receives committed opening feedback. Each input supplies the borrowed battle snapshot that offered it; commands reject stale snapshot identity inside the transaction before RNG or progress changes. Rejected inputs return null, so callers start presentation only after a committed result. Raw snapshot replacement and RNG binding stay private under `write/run-battle.ts`. Live resolutions commit an explicit Gold delta against the authoritative purse and tally earnings atomically. Snapshot Gold remains an engine/save input; historical unfinished battles are abandoned through the load instruction.
- **Gear reads and writes** — `gear-state-defaults.ts` owns pure initial-state and save-field factories so startup storage never imports the live session runtime. `gear-store.ts` provides data-only reads and its codec; `use-gear-store.ts` owns React slices and combat restrictions; `gear-session-command.ts` composes Gear, discovery, materials, and live-run rebinding within one command. Choose its outer or draft wrapper using [Armory write paths](./ARMORY.md#write-paths).
- **Session persistence** — `shared/storage/session-persistence.ts`: `createSessionPersistence(gameSession)` is the session capability port for snapshots, writes, exit writes, loading, platform configuration, recovery routing, clearing, and failure subscriptions. Feature code uses this port. Store-owned immediate lifecycle flushes use the same snapshot builder and acknowledgement-aware IO seam.
- **Lifecycle** — `run-lifecycle.ts` owns restore, snapshot, battle sync, and teardown including presentation listeners and battle UI clearing (import it directly). `finalizeRunEndSession` retains recap progress; `teardownRun` fully resets the live run.
- **Settings actions** — `settings-store.ts`: `useSettingsActions` / `useAppSettings` for App chrome. The public store exposes reads, subscriptions, and named actions; raw replacement and hydration authority stay with the settings owner and its persistence codec. Borrowed reads and actions check session lifetime, and subscriptions belong to that session. Homestead and Collection commands are first-class intent commands in `meta-commands.ts` exposed via `AlchemyRouteCommands.meta` and bound to the session controller.
- **Flow commands** — `navigation-commands.ts` supplies shell navigation and talent actions; `room-entry-commands.ts` applies room traits with activity initialization. Domain command modules beside run flows own destination claims, campfire healing, progression, Mystery/Corruption choices, Wildwood updates, and run settlement. Shell, battle presentation, and these flow adapters cannot import draft dispatch or setters (Oxlint-enforced). Feature command authors compose public domain operations inside a readonly transaction. Store-owned implementations retain raw draft access.
- **Route command composition** — `shell/use-alchemy-run-controller.ts` composes the explicit contracts in `shell/route-commands.ts`.
- **Navigation and rewards** — `shell/use-alchemy-run-controller.ts` wires React lifetime and display reads; `shell/run-flow-engine.ts` composes command factories. Start at `createRunFlow` in `run-loop/run/run-flow.ts`, its `run-flow-*.ts` modules, and `run-loop/navigation/mystery-event-navigation.ts` for destinations. Navigation vocabulary: `transition` is validated + delayed, `navigateTo` is `transition` sugar, `goToScreen` is `navigateTo` plus card-hover clear; every flow `navigateTo` clears hover by construction. Destination eligibility: pure `resolveAvailableDestinations` in `shared/run-flow/resolve-available-destinations.ts`, transaction projection and offer sampling in `shared/stores/destination-offer-command.ts`. Commands derive eligibility from their open transaction; shells supply no destination reader. Labyrinth combat traits travel via session store, not battle-starter args.
- **Mode entry** — Follow [run setup ownership](./ARCHITECTURE.md#run-setup-ownership) for mode selection, starter drafts, run-start snapshots, and Wildwood progression.
- **Battle control** — `shell/use-battle-controller.ts` provides commands; `app/screen-routes/use-battle-playback.ts` owns route playback. See [Battle path](./ARCHITECTURE.md#battle-path).
- **Shops** — `run-loop/shop/create-shop-actions.ts` composes the [shop command owners](./ARCHITECTURE.md#shop-commands).
- **Screen transitions** — `lib/routing/screen-transition-policy.ts` owns ordinary interactive edges and the separate meta-to-saved-run resume rule; `run-setup/run/run-resume-navigation.ts` selects the active run's saved screen before calling `resumeTo`. `shell/use-screen-transitions.ts` applies the same preparation, cancellation, and presentation timing to both paths. Each committed hook lifetime creates a navigation owner; replacement or unmount disposes it, unregisters restore/session cleanup, and revokes retained commands before they can prepare gameplay. Imperative owners expose the same idempotent `dispose()` operation and are also disposed with their session.

Run-ending gameplay belongs to `shared/stores/write/run-end.ts`: one `settleRunEnd`
operation captures earned resources, merges talent XP, unlocks the hero, captures
the recap, and ends activity atomically. Lifecycle commands take only the owning
session; feature code cannot supply or separately invoke material/XP settlement.
Reward claims compose the same operation through `settleRunVictory(transaction)`;
restore composes abandonment before publishing hydration. An inactive activity
returns rejection so repeated lifecycle requests cannot replay completion effects.

Controllers implement the explicit **command contracts** in `shell/route-commands.ts`; `use-alchemy-run-controller.ts` composes them. Shop and battle commands pass through directly, with shop continuation owned by run navigation. Screen contracts never derive from the composition root’s inferred return type. Screen routes own **display data** via their specific hooks. App chrome / autosave / particles read via capability hooks, not controller display re-exports. Imperative handlers read lifetime-specific ports at call time. Reward route commands expose `claimChoice(id)` and `skip()`: the reward command validates the offered ID and finalizes it atomically behind the claim guard. Card-only skipping explicitly finalizes with no choice, ignoring legacy persisted selection; `selectedId` remains save-compatible but no longer drives reward interaction. Battle refs and handlers travel through `routeCommands.battle`; battle display is read locally by the battle route. Battle-start commands derive gameplay and meta inputs from their open command draft instead of React controller props. Run-flow handlers take `RunFlowShellActions` and read gameplay fields from the command draft / read ports at call time. Room-entry presentation takes only navigation and opening-feedback callbacks (`RoomPresentation` in `run-destination-handlers.ts`); post-reward presentation is composed in `run-flow.ts`; reward commands commit the destination, act, node, or Wildwood transition atomically. Active-run core fields shared by committed session reads come from `pickActiveRunView` in `run-state-init.ts`.

Boot: [`use-alchemy-bootstrap.ts`](../src/app/use-alchemy-bootstrap.ts) calls `SessionPersistence.restore`, which delegates to `restoreSessionSave` before publishing bootstrap readiness (preserving an already initialized activity), so [`App.tsx`](../src/App.tsx) cannot render `AppInner` against an unhydrated run. [`bootstrap-save-state.ts`](../src/features/alchemy/shared/storage/bootstrap-save-state.ts) initializes Steam, configures the save backend from the returned capabilities, and only then loads candidates. `restoreRun` and `restoreSessionSave` share the same run restoration recipe; complete saves hydrate gameplay codecs inside that recipe's transaction.

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
