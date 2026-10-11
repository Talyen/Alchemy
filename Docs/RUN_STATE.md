# Run state and persistence

## Run state

Each game session owns one authoritative nested Zustand aggregate constructed in `shared/stores/gameplay-state.ts`. `gameplay-state-store.ts` keeps the application’s existing hooks bound to its default session. Its `run`, `session`, `runProfile`, `profile`, and `gear` objects are the domain-shaped state, and the aggregate is data-only: draft mutators in `run-session-write-port.ts` (plus `homestead-actions.ts` / `gear-actions.ts`) compose atomic changes. Feature commands receive a deeply readonly `RunTransaction`, with live reads of the same draft. Only store-owned mutation implementations and bootstrap hydration receive the raw `GameplayDraft`; feature commands cannot assign fields or mutate nested collections directly. Feature orchestration should call intent-level commands rather than assemble field updates. `profile-store.ts` and `gear-store.ts` are thin aggregate-backed persistence/adapter modules; they do not own shadow state. The write module, reads, commands, and `run-lifecycle.ts` are the feature-facing seams. Independent runtimes follow [Session ownership](#session-ownership).

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
replaces combat with rewards in one operation. Run termination makes activity
inactive and removes command access to combat in the same transaction. Card,
Wish, and end-turn commands reject absent combat; end turn also checks the player
input phase and pending Wishes. Duplicate starts and victory settlements reject
without publishing state or consuming RNG.

The battle route retains its outgoing display data through delays and fades.
Outcome playback transfers its final frame into `battle-presentation-store`
before settlement removes combat. Those retained frames are presentation only,
never gameplay command inputs or resume data. Menu and meta navigation remain
independent of activity, so an unfinished battle stays resumable there.

Live reads and screen data expose `runProfile.gold` as `gold`; `startGold` grants once on a new run start. `profile` never owns gameplay currency. Homestead and talent mutations rebind live Health and battle manifests through the owning command. Battle VFX live separately in `run-loop/battle/` (state in `battle-presentation-store.ts`, overlays in `presentation/` leaves) and are not persisted.

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

`run-session-write-port.ts` adapts the existing domain mutators to transactions; it does not own a second store. Raw dispatch (`gameplay-command.ts`), draft lookup (`transaction-internal.ts`), and read-facade internals are restricted by import boundaries. A transaction can write only during its callback; retained handles cannot write in `afterCommit` or another command. `snapshotTransactionValue(value)` returns a detached value for engine APIs that require mutable types. Command results automatically detach nested transaction reads before publication, so read facades never enter saves or playback.

Commands are synchronous and must not span an `await`. The command factory and
Gear mutation wrappers reject Promise-like result types, including unions with
asynchronous results. The runtime boundary also rejects thenables before
publication, preserving the root, revision, and RNG counters. Rejected
asynchronous continuations are observed to avoid an additional unhandled
rejection; the boundary cannot cancel external work already started by an
invalid callback.

### Post-commit behavior

Audio, navigation timers, presentation updates, and other non-rollbackable work
use `afterCommit` or run after the command returns. Every normally returning command
runs `afterCommit` exactly once only when accepted, including no-op assignments and
accepted `false` results; rejection and thrown execution errors skip it. Rejection
feedback belongs outside the transaction and can use the returned fallback value.

The command guard is released before `afterCommit`, so an effect may dispatch a
separate command. If an effect throws, its error propagates and the already
committed state remains; post-commit errors do not roll back gameplay.

### Committed battle playback

Battle reads expose serializable `BattleSnapshot` values. Opening draws and card
plays commit before presentation. `commitEndTurn` resolves the turn and its
Companion follow-up with `resolveBattleTurn`, awards Dodge XP, and publishes the
result atomically before discard or enemy animation.

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
keep ownership private in `session-capabilities.ts`. Flow and Labyrinth routing
reject mixed-session outcomes, navigation, battle commands, and node callbacks
before they can mutate gameplay. Pure presentation callbacks need no session.
Outcome handlers remain constructed before battle controllers; their separate
composition is checked rather than replaced with late callback binding.

The singleton is constructed only in `app/application-session.ts`. React hooks
subscribe to that application's session without an additional provider. The
explicit shipping adapter list in `lint/session-ownership.js` covers application hooks,
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
cancel another session’s timers or writes.

## Activity and rewards

Campaign and Labyrinth room entry use `enterRunRoom` in
`run-loop/run/room-entry-commands.ts`. Its typed request selects an offered
Campaign destination or the selected reachable Labyrinth node. Validation,
activity initialization, encounter traits, history/progression, and seeded RNG
commit together. Rejection and initialization errors preserve the previous root
and revision. The returned screen and detached opening battle feedback contain
no gameplay mutation callbacks; shell navigation and feedback run after entry.
A presentation error does not undo accepted room entry. Save wire fields and
resume decoding remain unchanged.

`session.activity.kind === "inactive"` is the sole stored marker for an inactive run. Active runs may have `idle` while being prepared; meta screens preserve the current activity. Read ports derive `hasActiveRun`; it is not a second stored boolean. `session.rewardFlow` owns the current reward bundle, Companion cards, and one claim union (`idle`, `reward`, or `destination` with its destination). Reward and destination claims cannot both be active. The visible navigation screen remains independent so menus and fades do not redefine the resume location. Save codecs retain the existing wire fields.

`reward-commands.ts` owns selection validation, grants, and advancement to the next reward bundle in one transaction. Its claim lock prevents re-entry until routing settles, but save encoding uses the already-advanced bundle rather than inferring which reward was awarded from the lock. Legacy `companion-reward` saves remain readable. `victory-commands.ts` owns victory rewards and the Wildwood phase change, rejects repeated completion, and enters the rewards activity atomically. The matching run-flow modules own navigation and feedback.

Activity encoding follows the [persistence API](./RUN_STATE.md#persistence-api); [navigation data flow](./BATTLE_CONTROLLERS.md#data-flow) defines when preparation commits.

## Anti-patterns

- No all-screens display bag or second flattening read model. Each route owns its exact screen-specific hook (`RunScreenDataByScreen`, inferred from the selectors in `run-screen-data.ts`). Menu badge dots (`useMenuBadges` in `src/app/app-screen-chrome-context.tsx`) are the blessed exception: they derive talent/homestead affordability only on the Menu route, never through the always-mounted chrome provider. Screens must not import app-shell orchestration (`SCREENS_NO_APP_ORCHESTRATION`); leaf capability modules (`escape-stack`, `screen-particle-config`, chrome context) stay allowed.

## Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Commands obtain generators through `createDraftRunRandomSource(draft, stream)` so counters commit or roll back with gameplay. `BattleSnapshot` contains only data. `BattleResolutionContext` supplies execution-only action scope and the RNG to `resolveBattleTurn`; individual engine handlers use the execution-only `BattleState` supplied by `withDraftWorldBattleRng`. Engine draws use `getBattleRng(state)`. `battleSnapshot` removes those execution dependencies before publication or return. Stored snapshots and presentation frames contain no RNG callback. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw.

Destination offers use the `destinations` stream for sampling. They draw a boss from `world` only when the offer contains Boss Combat alone and has no saved boss ID. Ordinary offers and resuming a valid boss preview do not advance `world`.

`Math.random()` may create a fresh run seed or presentation-only values that cannot affect gameplay or persisted state. [Armory crafting and dev spawning](./ARMORY.md#write-paths) are the intentional gameplay exception: they use injected profile-lifetime randomness, defaulting to `Math.random`, without consuming a run stream. Salvage instead derives its fixed reward seed from the item instance ID. Other run outcomes use the persisted streams above.

Run-luck helpers live in `@/lib/rng` (the single door), small math in `@/lib/math`, and class-name/string/id helpers in `@/lib/utils`. Every draw stays in `[0, 1)`; unknown streams, out-of-range draws, empty ranges, and negative sample counts throw in every build. Counters hash as `counter + 1`, so resume continues at the exact next draw. Snapshot-only placeholders always draw zero and must never reach live combat. Full battle RNG + arithmetic rules: [GAME_RULES](./GAME_RULES.md).

`pickWeighted(items, weightOf, rng)` owns weighted selection for destinations, loot, and Corruption. It evaluates finite non-negative weights once, uses half-open buckets in item order, and consumes one draw for a positive pool, including a single eligible item. Empty or all-zero pools return `undefined` without drawing; each caller owns its unavailable-pool behavior. Floating-point fallback selects the last positive weight. Integer magnitude and map-position rolls use `rngInt`, retaining one draw even for a fixed value.

Choosing one encounter trait draws once from its eligible pool. Wildwood boss preparation draws once for its combat trait and once for its reward trait after selecting a boss; refilling the boss bag has its own draws.

## Completed actions and local saving

The renderer marks persisted gameplay commits as pending before publishing them.
`SessionPersistence` exposes `checkpoint`, `readProgress`, `subscribeProgress`,
`trackProgress`, `retryProgress`, and `afterProgressSaved`. A checkpoint carries
the gameplay revision and a runtime epoch; only a covering local write in that
epoch acknowledges completion. The save envelope does not gain scheduling data.

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
Clear, restore, write protection, and disposal invalidate pending completion callbacks.
Completed actions survive process termination after local acknowledgement. This
promise does not cover power loss, subsequent filesystem failure, or browser eviction.

Steam Cloud mirrors serialize independently and coalesce queued payloads per slot.
Local acknowledgement does not wait for Cloud. Deletion discards queued uploads and
drains an in-flight upload before removing mirrors so it cannot resurrect a save.

## Persistence API

`run-resume-codec.ts` translates `RunSession` and `ActiveRunData`. The encoder selects
progress, mode geography, and one tagged `activity`; the decoder hydrates that
branch and derives its route directly. Historical screen/visit/reward precedence
exists only in the version 20-to-21 migration. `run-restore.ts` applies the decoded
fields and explicit current-data repairs in the command draft.

`run-lifecycle.ts` exposes `snapshotRun(session)` and `restoreRun(…)` for snapshotting and boot/resume, including Trinket-manifest repair. `parseActiveRun(raw)` validates JSON before hydration; `toActiveRunData` in `lib/active-run-session/parse.ts` handles run parsing, while `PersistedBattleStateSchema` owns battle wire parsing and default merging.

Domain persistence codecs own field selection, defaults, encoding, hydration, and subscriptions. `GameplayPersistenceCodec<T>` receives a `GameplayDraft`; `StandalonePersistenceCodec<T>` owns a separate Zustand store. `shared/storage/persistence.ts` composes their fields into the versioned envelope and subscribes to settings changes plus the gameplay commit signal. Codec types live in `shared/stores/persistence-codec.ts`.

`shared/stores/persistence-commit-filter.ts` decides whether a committed state change can alter the save. It compares the saved run, activity (including active combat), profile, and Gear inputs directly; permanent progress uses the save keys from `run-profile-codec.ts`, excluding derived Homestead effects. Session comparisons follow the transient and mode-gated fields declared by `run-resume-codec.ts`. Reward state and Companion cards count, while the claim lock does not. Every run and session field must be classified at typecheck time so a newly added field cannot silently bypass autosave.

`shared/storage/save-candidates.ts` owns save parsing, validation, and future-version protection (deterministic `evaluateSaveCandidates`, for testability); `shared/storage/save-storage.ts` owns each storage instance’s backend, queue, write protection, and load/write/exit/clear operations. `shared/storage/io.ts` preserves the app function API over the selected session’s IO instance and owns the unconfigured storage guard. The application adapter preserves the SSR guard. Backend configuration is allowed only while loads, writes, and clears are idle, so submitted work cannot move to a different transport. Bootstrap configures the application instance; each headless career configures its own instance; isolated tests can construct `SaveStorage` directly. The queue is private to its storage owner. `src/lib/platform-save-backend.ts` owns browser/desktop transport, backup/cloud candidate order, and recoverable write/clear ordering. `initializeSteam()` returns an explicit `cloudSyncEnabled` capability; it does not mutate shared platform state. Candidate order, Steam Cloud as a one-way mirror, and wipe/protect behavior: [MIGRATIONS.md § Public save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract).

The storage owner reads primary and recovery slots before selecting the freshest playable save. Unreadable or newer-format data stays in its slot while new progress saves to the other slot; a failed primary write also tries recovery. Load status is diagnostic only, so the app continues into play without a save-problem screen. The [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract) owns the exact routing and wipe rules.

Current-run reads remain detached. Restoring active combat returns to battle before considering the mode map or destination route.

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

The permanent purse owns Gold. Live battle commands reconcile the engine output delta against that purse in the same transaction. Purse writes update the current battle input. Battle restore hydrates and rebinds the committed snapshot without executing gameplay. Retired legacy input/result pairs never reconcile uncommitted earnings. Run Health is carried between battles; the battle snapshot owns combat Health until run settlement, while live meta rebinding updates the shared maximum and clamps current Health.

- **Autosave scheduling:** `app/autosave-scheduler.ts` owns revision acknowledgement, cancellation epochs, maximum wait, retry decisions, and the exit-once latch for one subscription lifetime. Its factory is the only scheduling API; submission and completion update the same private state, and tests exercise save sequences through that API. The shared `app/autosave-lifecycle.ts` supplies subscriptions, debounce selection, snapshots, completion gating, and storage writes with an injectable clock/timer seam. The React adapter supplies lifecycle events; the headless runner uses the same lifecycle without mounting React. Explicitly configured save backends also run outside a browser; unconfigured SSR retains its no-storage behavior. Late completions from cancelled epochs cannot acknowledge new progress. `SaveWriteQueue.storageEpoch` separately guards storage invalidation (clear/protection/reset) for all queue writers, including non-scheduler fast paths.

Run recap tracking belongs to active-run progress: chronological visits and earned
Gold persist through the existing resume codec. Room entry/completion and Gold grants
use the write port; battle-to-purse commits count only newly earned Gold, never purse
mirror synchronization. Run finalization captures a detached `runRecap` (history,
ending and room identity, deck, Boons, earned Gold) before making activity inactive. Completion and the ending marker resolve the current visit by identity, since an unresolved room can be revisited after later history entries. The screen-data
capability supplies the recap; card inspection selects its deck on ending screens.
The recap is transient, survives voluntary teardown, and clears on a fresh run.

## Session capability ports

Use this reference for access and orchestration; unprefixed store filenames are under `shared/stores/`.

- **Committed reads** — `run-reads.ts`: data-only `readActiveRun`, `readRunProfile`, `readRunSession`, `readBattle`, and shop reads. React hooks provide narrow navigation, Homestead, talent, draft, and content-navigation slices; `useActiveRunScreenValue` reads the presentation screen.
- **Screen display** — `run-screen-data.ts` owns the exact selectors and derives `RunScreenDataByScreen` from their return types; `use-run-screen-data.ts` subscribes once per route and retains its last active data during fades. Visit hooks follow activity; run recaps follow the visible ending screen because settlement makes activity inactive. Battle uses `app/screen-routes/use-battle-screen-route-data.ts`, composing `useRunSessionBattleContext` for display, never shell command inputs.
- **Commands and writes** — `run-session-command.ts` owns dispatch and `createRunSessionCommand` bindings. `run-session-write-port.ts` exposes domain operations with `RunTransaction` as their first argument; `set*` accepts a value or readonly updater. The internal `gameplay-command.ts` retains the single draft/commit coordinator. There is one import path for writes; implementations are split by domain under `shared/stores/write/` behind that barrel.
- **Battle commands** — `battle-commands.ts` owns card play, Wish selection, and turn completion; `battle-start-commands.ts` owns standalone validated starts; room entry composes the same `initializeBattle` transaction operation. Its `presentBattleStart` callback receives committed opening feedback. Rejected end turns return null, so callers start presentation only after a committed result. Raw snapshot replacement and RNG binding stay private under `write/run-battle.ts`. Live resolutions commit an explicit Gold delta against the authoritative purse and tally earnings atomically. Snapshot Gold remains an engine/save input; historical unfinished battles are abandoned through the load instruction.
- **Gear reads and writes** — `gear-store.ts` provides data-only slices and its codec; `gear-session-command.ts` composes Gear, discovery, materials, and live-run rebinding within one command. Choose its outer or draft wrapper using [Armory write paths](./ARMORY.md#write-paths).
- **Session persistence** — `shared/storage/session-persistence.ts`: `createSessionPersistence(gameSession)` is the session capability port for snapshots, writes, exit writes, loading, platform configuration, recovery routing, clearing, and failure subscriptions. Feature code and store lifecycles use this port rather than calling raw storage IO functions directly.
- **Lifecycle** — `run-lifecycle.ts` owns restore, snapshot, battle sync, and teardown including presentation listeners and battle UI clearing (import it directly). `finalizeRunEndSession` retains recap progress; `teardownRun` fully resets the live run.
- **Settings actions** — `settings-store.ts`: `useSettingsActions` / `useAppSettings` for App chrome. Collection and Homestead commands use module-level `createRunSessionCommand` bindings beside their routes.
- **Flow commands** — `navigation-commands.ts` supplies shell navigation and talent actions; `room-entry-commands.ts` applies room traits with activity initialization. Domain command modules beside run flows own destination claims, campfire healing, progression, Mystery/Corruption choices, Wildwood updates, and run settlement. Shell, battle presentation, and these flow adapters cannot import draft dispatch or setters (Oxlint-enforced). Feature command authors compose public domain operations inside a readonly transaction. Store-owned implementations retain raw draft access.
- **Route command composition** — `shell/use-alchemy-run-controller.ts` composes the explicit contracts in `shell/route-commands.ts`.
- **Navigation and rewards** — `shell/use-alchemy-run-controller.ts` wires React lifetime and display reads; `shell/run-flow-engine.ts` composes command factories. Start at `createRunFlow` in `run-loop/run/run-flow.ts`, its `run-flow-*.ts` modules, and `run-loop/navigation/mystery-event-navigation.ts` for destinations. Navigation vocabulary: `transition` is validated + delayed, `navigateTo` is `transition` sugar, `goToScreen` is `navigateTo` plus card-hover clear; every flow `navigateTo` clears hover by construction. Destination reads: pure `getRunAvailableDestinations` in `shared/run-flow/destination-flow.ts`, store-backed `readRunAvailableDestinations` in `shell/run-destination-wiring.ts`. Labyrinth combat traits travel via session store, not battle-starter args.
- **Mode entry** — Follow [run setup ownership](./ARCHITECTURE.md#run-setup-ownership) for mode selection, starter drafts, run-start snapshots, and Wildwood progression.
- **Battle control** — `shell/use-battle-controller.ts` provides commands; `app/screen-routes/use-battle-playback.ts` owns route playback. See [Battle path](./ARCHITECTURE.md#battle-path).
- **Shops** — `run-loop/shop/create-shop-actions.ts` composes the [shop command owners](./ARCHITECTURE.md#shop-commands).
- **Screen transitions** — `lib/routing/screen-transition-policy.ts` owns ordinary interactive edges and the separate meta-to-saved-run resume rule; `run-setup/run/run-resume-navigation.ts` selects the active run's saved screen before calling `resumeTo`. `shell/use-screen-transitions.ts` applies the same preparation, cancellation, and presentation timing to both paths.

Controllers implement the explicit **command contracts** in `shell/route-commands.ts`; `use-alchemy-run-controller.ts` composes them. Shop and battle commands pass through directly, with shop continuation owned by run navigation. Screen contracts never derive from the composition root’s inferred return type. Screen routes own **display data** via their specific hooks. App chrome / autosave / particles read via capability hooks, not controller display re-exports. Imperative handlers read lifetime-specific ports at call time. Reward route commands expose `claimChoice(id)` and `skip()`: the reward command validates the offered ID and finalizes it atomically behind the claim guard. Card-only skipping explicitly finalizes with no choice, ignoring legacy persisted selection; `selectedId` remains save-compatible but no longer drives reward interaction. Battle refs and handlers travel through `routeCommands.battle`; battle display is read locally by the battle route. Battle-start commands derive gameplay and meta inputs from their open command draft instead of React controller props. Run-flow handlers take `RunFlowShellActions` and read gameplay fields from the command draft / read ports at call time. Room-entry presentation takes only navigation and opening-feedback callbacks (`RoomPresentation` in `run-destination-handlers.ts`); post-reward presentation is composed in `run-flow.ts`; reward commands commit the destination, act, node, or Wildwood transition atomically. Active-run core fields shared by committed session reads come from `pickActiveRunView` in `run-state-init.ts`.

Boot: [`use-alchemy-bootstrap.ts`](../src/app/use-alchemy-bootstrap.ts) applies persistence owners via `hydrateAlchemyPersistenceFields` and then calls the canonical `restoreRun` transition before publishing bootstrap readiness (guarded by `readRunInitialized`), so [`App.tsx`](../src/App.tsx) cannot render `AppInner` against an unhydrated run. [`bootstrap-save-state.ts`](../src/features/alchemy/shared/storage/bootstrap-save-state.ts) initializes Steam, configures the save backend from the returned capabilities, and only then loads candidates. `restoreRun` is the only runtime run-session hydration path; settings/profile/gear hydration flows through the persistence codecs first.

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
