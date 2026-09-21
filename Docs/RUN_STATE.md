# Run state and persistence

## Run state

Gameplay state has one authoritative nested Zustand aggregate in `shared/stores/gameplay-state-store.ts`. Its `run`, `session`, `battle`, `runProfile`, `profile`, and `gear` objects are the domain-shaped state, and the aggregate is data-only: draft mutators in `run-session-write-port.ts` (plus `homestead-actions.ts` / `gear-actions.ts`) compose atomic changes. A command owns the full aggregate draft; importing the write module does not itself restrict which domains that command can access. Feature orchestration should call intent-level commands rather than assemble field updates. `profile-store.ts` and `gear-store.ts` are thin aggregate-backed persistence/adapter modules; they do not own shadow state. The write module, reads, commands, and `run-lifecycle.ts` are the feature-facing seams.

| Aggregate region | Concern                                                                                                                                                                                    | Lifetime                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `run`            | Deck, HP, acts, run Boons on `run.activeRun`; presentation screen on `run.navigation`; one resumable active run                                                                            | Resets on run termination                                                                                                 |
| `session`        | One active activity/visit, rewards, labyrinth progress, pending selections, and run-flow claims                                                                                            | Per live run; active visits persist via the resume codec; the run’s reward bundles persist in `activeRun.interruptedFlow` |
| `battle`         | Combat snapshot and battle-start state                                                                                                                                                     | Transient per battle; rebound from live meta on hydrate                                                                   |
| `runProfile`     | Homestead (buildings/farms/research/companions), talent XP / unlocks, derived `effects`, and the shared gold purse — persisted as flat top-level save fields via `run-profile-codec` codec | Profile lifetime                                                                                                          |
| `profile`        | Collection discoveries, completed difficulties, and finished-run character unlocks; collection tab/page UI is transient in-memory, outside `ProfileSaveFields`                             | Profile lifetime                                                                                                          |
| `gear`           | Permanent inventories, loadouts, and crafting currencies                                                                                                                                   | Profile lifetime                                                                                                          |

Live reads and screen data expose `runProfile.gold` as `gold`; `startGold` grants once on a new run start. `profile` never owns gameplay currency. Homestead and talent mutations rebind live Health and battle manifests through the owning command. Battle VFX live separately in `run-loop/battle/` (state in `battle-presentation-store.ts`, overlays in `presentation/` leaves) and are not persisted.

### Command atomicity

Gameplay mutation callers enter through `dispatchRunSessionCommand()` from
`run-session-command.ts`. The boundary opens one Immer draft of the authoritative
aggregate and publishes a new root with one incremented revision when state
changes. Unchanged commands preserve the root and revision and emit no commit
signal; thrown execution errors discard the draft. React selectors and autosave subscribe to
that same root. Settings and presentation-only state remain separate.

Draft mutators receive the draft explicitly and compose inside one command;
a command body must not call another command. Transactional checks that guard
a write (shop Gold, refresh counts, purchased slots) read from that draft rather
than a committed read port. Validate before writing: returning `false` or another
rejection result does not roll back draft changes. Persistence adapters may subscribe to the aggregate
commit signal directly; gameplay callers must not.

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
runs `afterCommit` exactly once, including no-op assignments and `false` results;
thrown execution errors skip it. Feedback must check the returned outcome before
announcing a successful action.

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
cannot roll back or advance gameplay. Create detached frames from
`current(draft.battle.battleState)` so no revoked Immer proxy can escape the command.

`activeCombat.pendingBattleTransition` remains a supported legacy save contract:
`battle-restore.ts` consumes its precomputed result during hydration and resolves
remaining logical work atomically with RNG and XP. No pending transition or resume
flag enters live state. New saves write this legacy field as null. An active
terminal battle remains serializable until its victory/defeat outcome settles. `playerDodgeCount` and
`dodgeChanceFromDamage` are battle-owned, start at zero, and persist across turns.
The Health-damage boundary requires explicit `hostile` or `self` provenance for
Finding Rhythm; Health costs do not award it.

## Activity and rewards

`session.activity.kind === "inactive"` is the sole stored marker for an inactive run. Active runs may have `idle` while being prepared; meta screens preserve the current activity. Read ports derive `hasActiveRun`; it is not a second stored boolean. `session.rewardFlow` owns the current reward bundle, Companion cards, and one claim union (`idle`, `reward`, or `destination` with its destination). Reward and destination claims cannot both be active. The visible navigation screen remains independent so menus and fades do not redefine the resume location. Save codecs retain the existing wire fields.

`reward-commands.ts` owns selection validation, grants, and advancement to the next reward bundle in one transaction. Its claim lock prevents re-entry until routing settles, but save encoding uses the already-advanced bundle rather than inferring which reward was awarded from the lock. Legacy `companion-reward` saves remain readable. `victory-commands.ts` owns victory rewards and the Wildwood phase change, rejects repeated completion, and enters the rewards activity atomically. The matching run-flow modules own navigation and feedback.

Activity encoding follows the [persistence API](./RUN_STATE.md#persistence-api); [navigation data flow](./BATTLE_CONTROLLERS.md#data-flow) defines when preparation commits.

## Anti-patterns

- No all-screens display bag or second flattening read model. Each route owns its exact screen-specific hook (`RunScreenDataByScreen` in `run-screen-data.ts`). Menu badge dots (`useMenuBadges` in `src/app/app-screen-chrome-context.tsx`) are the blessed exception: they derive talent/homestead affordability only on the Menu route, never through the always-mounted chrome provider. Screens must not import app-shell orchestration (`SCREENS_NO_APP_ORCHESTRATION`); leaf capability modules (`escape-stack`, `screen-particle-config`, chrome context) stay allowed.

## Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Commands obtain generators through `createDraftRunRandomSource(draft, stream)` so counters commit or roll back with gameplay. `BattleSnapshot` contains only data. `BattleResolutionContext` supplies execution-only action scope and the RNG to `resolveBattleTurn`; individual engine handlers use the execution-only `BattleState` supplied by `withDraftWorldBattleRng`. Engine draws use `getBattleRng(state)`. `battleSnapshot` removes those execution dependencies before publication or return. Stored snapshots and presentation frames contain no RNG callback. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw.

`Math.random()` may create a fresh run seed or presentation-only values that cannot affect gameplay or persisted state. [Armory crafting and dev spawning](./ARMORY.md#write-paths) are the intentional gameplay exception: they use injected profile-lifetime randomness, defaulting to `Math.random`, without consuming a run stream. Salvage instead derives its fixed reward seed from the item instance ID. Other run outcomes use the persisted streams above.

Run-luck helpers live in `@/lib/rng` (the single door), small math in `@/lib/math`, and class-name/string/id helpers in `@/lib/utils`. Every draw stays in `[0, 1)`; unknown streams, out-of-range draws, empty ranges, and negative sample counts throw in every build. Counters hash as `counter + 1`, so resume continues at the exact next draw. Snapshot-only placeholders always draw zero and must never reach live combat. Full battle RNG + arithmetic rules: [GAME_RULES](./GAME_RULES.md).

## Persistence API

`run-resume-codec.ts` is the single feature-owned `RunSession` ↔ `ActiveRunData` translation boundary. `encodeRunResumeSnapshot(source)` assembles the wire shape through `encodeActiveRunFromSession`, `encodePersistedShops`, and `encode-interrupted-flow.ts`; `decodeRunResumeSnapshot(data)` returns aggregate session fields. Legacy screen inference remains for decoding and an uninitialized activity. `run-restore.ts` applies decoded fields to the command draft.

`run-lifecycle.ts` exposes `snapshotRun(screen?)` and `restoreRun(…)` for snapshotting and boot/resume, including Trinket-manifest repair. `parseActiveRun(raw)` validates JSON before hydration; `toActiveRunData` in `lib/active-run-session/parse.ts` handles run parsing, while `PersistedBattleStateSchema` owns battle wire parsing and default merging. Legacy pending transitions follow the [command and playback contract](./RUN_STATE.md#run-state).

Domain persistence codecs own field selection, defaults, encoding, hydration, and subscriptions. `GameplayPersistenceCodec<T>` receives a `GameplayDraft`; `StandalonePersistenceCodec<T>` owns a separate Zustand store. `shared/storage/persistence.ts` composes their fields into the versioned envelope and subscribes to settings changes plus the gameplay commit signal. Codec types live in `shared/stores/persistence-codec.ts`.

`shared/storage/save-candidates.ts` owns save parsing, validation, and future-version protection (deterministic `evaluateSaveCandidates`, for testability); `shared/storage/io.ts` collects candidates, applies the write-disable policy, and owns write serialization. Both delegate raw persistence to one `SaveBackend` configured during bootstrap. `src/lib/platform-save-backend.ts` owns browser/desktop transport, backup/cloud candidate order, and recoverable write/clear ordering. `initializeSteam()` returns an explicit `cloudSyncEnabled` capability; it does not mutate shared platform state. Candidate order, Steam Cloud as a one-way mirror, and wipe/protect behavior: [MIGRATIONS.md § Public save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract).

Current-run reads remain detached. Restoring active combat returns to battle before considering the mode map or destination route.

`session.activity` is a discriminated `RunActivity`: it records the logical gameplay location and owns exactly one shop, Mystery visit, or Corruption result. Persistent mode progress and reward bundles remain session data because they span activities. `run.navigation.screen` is presentation navigation; opening menus never replaces the activity. Shop initialization and battle/victory commands establish their activities, and `prepareRunNavigation` records a gameplay destination before presentation delays. New-run initialization clears the activity; restore decodes the existing wire fields into one activity. Autosave and Armory flushes encode its location as `ActiveRunData.currentScreen`. Mystery visits remain encoded only while `ActiveRunData.currentScreen` is mystery. Activity encoding retains the existing active-run fields; the single-run envelope follows the current save baseline.

Reward grants and bundle advancement follow [Activity and rewards](./RUN_STATE.md#activity-and-rewards); mode selection and resume follow [Run setup ownership](./ARCHITECTURE.md#run-setup-ownership).

The permanent purse owns Gold. Live battle commands reconcile the engine output delta against that purse in the same transaction. Purse writes update the current battle input. Only `battle-restore.ts` understands legacy input/result Gold pairs: hydration applies their difference once, then discards the continuation. Saving and restoring the resulting current snapshot cannot pay the difference again. Run Health is carried between battles; the battle snapshot owns combat Health until run settlement, while live meta rebinding updates the shared maximum and clamps current Health.

- **Autosave scheduling:** `app/autosave-scheduler.ts` owns revision acknowledgement, cancellation epochs, maximum wait, retry decisions, and the exit-once latch for one subscription lifetime. The shared `app/autosave-lifecycle.ts` supplies subscriptions, debounce selection, snapshots, completion gating, and storage writes with an injectable clock/timer seam. The React adapter supplies lifecycle events; the headless runner uses the same lifecycle without mounting React. Explicitly configured save backends also run outside a browser; unconfigured SSR retains its no-storage behavior. Late completions from cancelled epochs cannot acknowledge new progress. `SaveWriteQueue.storageEpoch` separately guards storage invalidation (clear/protection/reset) for all queue writers, including non-scheduler fast paths.

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
- **Screen display** — `run-screen-data.ts` defines `RunScreenDataByScreen`; `use-run-screen-data.ts` provides exact screen hooks. Battle uses `app/screen-routes/use-battle-screen-route-data.ts`, composing `useRunSessionBattleContext` for display, never shell command inputs.
- **Commands and writes** — `run-session-command.ts` owns dispatch and `createRunSessionCommand` bindings. `run-session-write-port.ts` owns every gameplay draft mutator with `GameplayDraft` as its first argument; `set*` accepts a value or updater. There is one import path for writes (see deleted-module guard); implementations are split by domain under `shared/stores/write/` behind that barrel.
- **Battle commands** — `battle-commands.ts` owns card play, Wish selection, and turn completion; `battle-start-commands.ts` owns initialization. Raw snapshot replacement and RNG binding stay private under `write/run-battle.ts`. Live resolutions commit an explicit Gold delta against the authoritative purse and tally earnings atomically. Snapshot Gold remains an engine/save input; legacy reconciliation stays inside `battle-restore.ts`.
- **Gear reads and writes** — `gear-store.ts` provides data-only slices and its codec; `gear-session-command.ts` composes Gear, discovery, materials, and live-run rebinding within one command. Choose its outer or draft wrapper using [Armory write paths](./ARMORY.md#write-paths).
- **Lifecycle** — `run-lifecycle.ts` owns restore, snapshot, battle sync, and teardown including presentation listeners and battle UI clearing (import it directly; the old lifecycle barrel is deleted — see deleted-module guard). `finalizeRunEndSession` retains recap progress; `teardownRun` fully resets the live run.
- **Settings actions** — `settings-store.ts`: `useSettingsActions` / `useAppSettings` for App chrome. Collection and Homestead commands use module-level `createRunSessionCommand` bindings beside their routes.
- **Flow commands** — `navigation-commands.ts` supplies shell navigation, talent actions, and atomic room-trait preparation. Domain command modules beside run flows own destination claims, campfire healing, progression, Mystery/Corruption choices, Wildwood updates, and run settlement. Shell, battle presentation, and these flow adapters cannot import draft dispatch or setters (ESLint-enforced). Command authors compose the private write helpers inside a transaction.
- **Route command composition** — `shell/use-alchemy-run-controller.ts` composes the explicit contracts in `shell/route-commands.ts`.
- **Navigation and rewards** — `shell/use-run-flow-engine.ts` wires React lifetime and display reads; `shell/run-flow-engine.ts` composes command factories. Start at `createRunFlow` in `run-loop/run/run-flow.ts`, its `run-flow-*.ts` modules, and `run-loop/navigation/mystery-event-navigation.ts` for destinations. Navigation vocabulary: `transition` is validated + delayed, `navigateTo` is `transition` sugar, `goToScreen` is `navigateTo` plus card-hover clear; every flow `navigateTo` clears hover by construction. Destination reads: pure `getRunAvailableDestinations` in `shared/run-flow/destination-flow.ts`, store-backed `readRunAvailableDestinations` in `shell/run-destination-wiring.ts`. Labyrinth combat traits travel via session store, not battle-starter args.
- **Mode entry** — Follow [run setup ownership](./ARCHITECTURE.md#run-setup-ownership) for mode selection, starter drafts, run-start snapshots, and Wildwood progression.
- **Battle control** — `shell/use-battle-controller.ts` provides commands; `app/screen-routes/use-battle-playback.ts` owns route playback. See [Battle path](./ARCHITECTURE.md#battle-path).
- **Shops** — `run-loop/shop/create-shop-actions.ts` composes the [shop command owners](./ARCHITECTURE.md#shop-commands).
- **Screen transitions** — `lib/routing/screen-transition-policy.ts` owns allowed edges; `shell/use-screen-transitions.ts` owns presentation timing.

Controllers implement the explicit **command contracts** in `shell/route-commands.ts`; `use-alchemy-run-controller.ts` composes them. Shop and battle commands pass through directly, with shop continuation owned by run navigation. Screen contracts never derive from the composition root’s inferred return type. Screen routes own **display data** via their specific hooks. App chrome / autosave / particles read via capability hooks, not controller display re-exports. Imperative handlers read lifetime-specific ports at call time. Reward route commands expose `claimChoice(id)` and `skip()`: the reward command validates the offered ID and finalizes it atomically behind the claim guard. Card-only skipping explicitly finalizes with no choice, ignoring legacy persisted selection; `selectedId` remains save-compatible but no longer drives reward interaction. Battle refs and handlers travel through `routeCommands.battle`; battle display is read locally by the battle route. Battle-start commands derive gameplay and meta inputs from their open command draft instead of React controller props. Run-flow handlers take `RunFlowShellActions` and read gameplay fields from the command draft / read ports at call time. Pure destination routers take a `Pick` of those actions (`DestinationRouteDeps` in `run-destination-handlers.ts`); post-reward screen transitions live in `run-flow-rewards.ts` (`RewardRouteDeps`). Active-run core fields shared by committed session reads come from `pickActiveRunView` in `run-state-init.ts`.

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
