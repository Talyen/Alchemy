# Alchemy architecture

Canonical reference for run state, store layout, and boot policy. Coding rules: [AGENTS.md](../AGENTS.md). Gameplay / battle rules: [GAME_RULES.md § Battle](./GAME_RULES.md#battle-implementation-rules). How-to: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

`src/lib/` stays React-free. Feature UI lives under `src/features/alchemy/`.

## Directory layout (`src/features/alchemy/`)

| Path         | Role                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| `shared/`    | `stores/`, `storage/`, `ui/`, `config/`, `context/`, `utils/`, `run-flow/`, `types.ts` |
| `meta/`      | Menu, collection, homestead, talents, armory screens                                   |
| `run-setup/` | Character, difficulty, draft screens                                                   |
| `run-loop/`  | Battle glue, navigation, shop, in-run screens                                          |
| `shell/`     | Controller hooks                                                                       |

`shared/ui/tooltips/` owns tooltip placement, panels, and item popups; `shared/ui/inspection/` owns card and enemy inspection overlays and their grid/sorting helpers. General shared hooks stay directly in `shared/ui/`; battle-only playback visuals belong beside `run-loop/battle/presentation/`. Unit tests mirror these owners. Collection-only presentation lives in `meta/screens/collection/`; shop purchase and service widgets live in `run-loop/shop/ui/`. Mystery outcome badges live beside their screens in `run-loop/screens/mystery/`; Options controls live beside `meta/screens/options-panels.tsx`. Display scaling belongs to `shared/ui/use-virtual-resolution.ts`; the general latest-value ref hook belongs to `shared/ui/use-latest-ref.ts`. Import shared UI directly from its owning module rather than a catch-all barrel.

Import lib catalogs through their eslint-enforced barrels (`@/lib/game-data`, `@/lib/battle`, `@/lib/validation`, `@/lib/content-validation`). Feature stores and screens use on-disk paths (for example `@/features/alchemy/shared/stores/run-reads`). Feature UI reads static catalogs through [`shared/config/game-data-catalog.ts`](../src/features/alchemy/shared/config/game-data-catalog.ts). Content parity helpers live under `@/lib/content-validation/card-parity` (the only sanctioned deep path: relative imports inside the package plus test deep imports, which sit outside boundary lint; every other `src/` import goes through the barrel).

> Token-barrel exception: keep `game-data-catalog.ts` off the token `config/` barrel so layout/token imports stay catalog-free.

`shared/run-flow/` is the neutral seam for destination sampling and campaign-start helpers so `run-setup` and `run-loop` do not import each other (ESLint-enforced).

## Run state

Gameplay state has one authoritative nested Zustand aggregate in `shared/stores/gameplay-state-store.ts`. Its `run`, `session`, `battle`, `runProfile`, `profile`, and `gear` objects are the domain-shaped state, and the aggregate is data-only: draft mutators in `write-port-*.ts` (plus `homestead-actions.ts` / `gear-actions.ts`) compose atomic changes. A command owns the full aggregate draft; importing a write port does not itself restrict which domains that command can access. Feature orchestration should call intent-level commands rather than assemble field updates. `profile-store.ts` and `gear-store.ts` are thin aggregate-backed persistence/adapter modules; they do not own shadow state. The capability ports are the feature-facing seams.

| Aggregate region | Concern                                                                                                                                                                                    | Lifetime                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `run`            | Deck, HP, acts, run Boons on `run.activeRun`; presentation screen on `run.navigation`; parked mode snapshots (`parkedRuns`, `runRecency`)                                                  | Live run resets on teardown of that mode; other parked slots remain                                                          |
| `session`        | One active activity/visit, rewards, labyrinth progress, pending selections, and run-flow claims                                                                                            | Per live run; active visits persist via the resume codec; every mode’s reward bundles persist in `activeRun.interruptedFlow` |
| `battle`         | Combat snapshot, battle-start state, and legacy resume state                                                                                                                               | Transient per battle; rebound from live meta on hydrate                                                                      |
| `runProfile`     | Homestead (buildings/farms/research/companions), talent XP / unlocks, derived `effects`, and the shared gold purse — persisted as flat top-level save fields via `run-profile-codec` codec | Profile lifetime                                                                                                             |
| `profile`        | Collection discoveries, completed difficulties, and finished-run character unlocks; collection tab/page UI is transient in-memory, outside `ProfileSaveFields`                             | Profile lifetime                                                                                                             |
| `gear`           | Permanent inventories, loadouts, and crafting currencies                                                                                                                                   | Profile lifetime                                                                                                             |

Live ports and screen data expose `runProfile.gold` as `gold`; `startGold` grants once on a new run start. Legacy `activeRun.runGold` is copied into the purse on load and omitted from the current wire shape. `profile` never owns gameplay currency. Homestead and talent mutations rebind live Health and battle manifests through the owning command. Battle VFX live separately in `run-loop/battle/battle-presentation-store.ts` and are not persisted.

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
resume consumes its precomputed result once and resolves any remaining logical
work without replaying prior rolls or XP. `playerDodgeCount` and
`dodgeChanceFromDamage` are battle-owned, start at zero, and persist across turns.
The Health-damage boundary requires explicit `hostile` or `self` provenance for
Finding Rhythm; Health costs do not award it.

## Activity and rewards

`session.activity.kind === "inactive"` is the sole stored marker for an inactive run. Active runs may have `idle` while being prepared; meta screens preserve the current activity. Read ports derive `hasActiveRun`; it is not a second stored boolean. `session.rewardFlow` owns the current reward bundle, Companion cards, and one claim union (`idle`, `reward`, or `destination` with its destination). Reward and destination claims cannot both be active. The visible navigation screen remains independent so menus and fades do not redefine the resume location. Save codecs retain the existing wire fields.

`reward-commands.ts` owns selection validation, grants, and advancement to the next reward bundle in one transaction. Its claim lock prevents re-entry until routing settles, but save encoding uses the already-advanced bundle rather than inferring which reward was awarded from the lock. Legacy `companion-reward` saves remain readable. `victory-commands.ts` owns victory rewards and the Wildwood phase change, rejects repeated completion, and enters the rewards activity atomically. The matching run-flow modules own navigation and feedback.

Activity encoding follows the [persistence API](#persistence-api); [navigation data flow](#data-flow) defines when preparation commits.

## Anti-patterns

- No all-screens display bag or second flattening read model. Each route owns its exact screen-specific hook (`RunScreenDataByScreen` in `run-screen-data.ts`). Menu badge dots (`useMenuBadges` in `src/app/app-screen-chrome-context.tsx`) are the blessed exception: they derive talent/homestead affordability only on the Menu route, never through the always-mounted chrome provider. Screens must not import app-shell orchestration (`SCREENS_NO_APP_ORCHESTRATION`); leaf capability modules (`escape-stack`, `screen-particle-config`, chrome context) stay allowed.

## Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Commands obtain generators through `createDraftRunRandomSource(draft, stream)` so counters commit or roll back with gameplay. `BattleSnapshot` contains only data. `BattleResolutionContext` supplies the RNG to `resolveBattleTurn`; individual engine handlers use the execution-only `BattleState` supplied by `withDraftWorldBattleRng`. Engine draws use `getBattleRng(state)`. `battleSnapshot` (also exposed as `snapshotBattleState` by the write port) removes that execution dependency before publication or return. Stored snapshots, parked runs, and presentation frames contain no RNG callback. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw.

`Math.random()` may create a fresh run seed or presentation-only values that cannot affect gameplay or persisted state. [Armory crafting and dev spawning](./ARMORY.md#write-paths) are the intentional gameplay exception: they use injected profile-lifetime randomness, defaulting to `Math.random`, without consuming a run stream. Salvage instead derives its fixed reward seed from the item instance ID. Other run outcomes use the persisted streams above.

Run-luck helpers live in `@/lib/rng` (the single door), small math in `@/lib/math`, and class-name/string/id helpers in `@/lib/utils`. Every draw stays in `[0, 1)`; unknown streams, out-of-range draws, empty ranges, and negative sample counts throw in every build. Counters hash as `counter + 1`, so resume continues at the exact next draw. Snapshot-only placeholders always draw zero and must never reach live combat. Full battle RNG + arithmetic rules: [GAME_RULES](./GAME_RULES.md).

## Persistence API

`run-resume-codec.ts` is the single feature-owned `RunSession` ↔ `ActiveRunData` translation boundary. `encodeRunResumeSnapshot(source)` assembles the wire shape through `encodeActiveRunFromSession`, `encodePersistedShops`, and `encode-interrupted-flow.ts`; `decodeRunResumeSnapshot(data)` returns aggregate session fields. Legacy screen inference remains for decoding and an uninitialized activity. `run-park-restore.ts` applies decoded fields to the command draft.

The lifecycle port exposes `snapshotRun(screen?)` and `restoreRun(…)` for snapshotting and boot/resume, including Trinket-manifest repair. `parseActiveRun(raw)` validates JSON before hydration; `toActiveRunData` in `lib/active-run-session/parse.ts` handles run parsing, while `PersistedBattleStateSchema` owns battle wire parsing and default merging. Legacy pending transitions follow the [command and playback contract](#run-state).

Domain persistence codecs own field selection, defaults, encoding, hydration, and subscriptions. `GameplayPersistenceCodec<T>` receives a `GameplayDraft`; `StandalonePersistenceCodec<T>` owns a separate Zustand store. `shared/storage/persistence.ts` composes their fields into the versioned envelope and subscribes to settings changes plus the gameplay commit signal. Codec types live in `shared/stores/persistence-codec.ts`.

`shared/storage/save-candidates.ts` owns save parsing, validation, and future-version protection (deterministic `evaluateSaveCandidates`, for testability); `shared/storage/io.ts` collects candidates, applies the write-disable policy, and owns write serialization. Both delegate raw persistence to one `SaveBackend` configured during bootstrap. `platform-save-backend.ts` owns browser/desktop transport, backup/cloud candidate order, and recoverable write/clear ordering. `initializeSteam()` returns an explicit `cloudSyncEnabled` capability; it does not mutate shared platform state. Candidate order, Steam Cloud as a one-way mirror, and wipe/protect behavior: [MIGRATIONS.md § Public save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract).

Parked-run reads use `structuredClone` to return detached data, including any legacy pending battle result. Resuming a parked run with active combat returns to battle before considering the mode's map or destination route.

`session.activity` is a discriminated `RunActivity`: it records the logical gameplay location and owns exactly one shop, Mystery visit, or Corruption result. Persistent mode progress and reward bundles remain session data because they span activities. `run.navigation.screen` is presentation navigation; opening menus never replaces the activity. Shop initialization and battle/victory commands establish their activities, and `prepareRunNavigation` records a gameplay destination before presentation delays. New-run initialization clears the activity; restore decodes the existing wire fields into one activity. Autosave, Armory flushes, and parking encode its location as `ActiveRunData.currentScreen`. Mystery visits remain encoded only while `ActiveRunData.currentScreen` is mystery. The save format is unchanged.

Reward grants and bundle advancement follow [Activity and rewards](#activity-and-rewards); mode selection and resume follow [Run setup ownership](#run-setup-ownership).

Purse-to-battle synchronization updates both the current battle and any pending opening-draw or enemy-turn result. The pending result retains its unapplied Gold change relative to the current battle, so restoring a run preserves Gold earned or spent elsewhere. Hydration retains both saved Gold values until this synchronization runs; completing the transition applies the remaining change once through the battle-to-purse commit.

## Session capability ports

Use this reference for access and orchestration; unprefixed store filenames are under `shared/stores/`.

| Concern                   | Entry point and contract                                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Committed reads           | `run-reads.ts`: data-only `readActiveRun`, `readRunProfile`, `readRunSession`, `readBattle`, and shop reads. React hooks provide narrow navigation, Homestead, talent, draft, and content-navigation slices; `useActiveRunScreenValue` reads the presentation screen.                                      |
| Screen display            | `run-screen-data.ts` defines `RunScreenDataByScreen`; `use-run-screen-data.ts` provides exact screen hooks. Battle uses `app/screen-routes/use-battle-screen-route-data.ts`, composing `useRunSessionBattleContext` for display, never shell command inputs.                                               |
| Commands and writes       | `run-session-command.ts` owns dispatch and `createRunSessionCommand` bindings. `run-session-write-port.ts` re-exports topical mutators with `GameplayDraft` as their first argument; `set*` accepts a value or updater. Import `setHasActiveRun` through that port, never a private `write-port-*` module. |
| Battle writes             | The write port exposes `setBattleState` (purse-synced commit), `setSyncedBattleState` (replacement without purse changes), `initializeActiveBattle` (fresh hydrate), and `commitBattleTransition`.                                                                                                         |
| Gear reads and writes     | `gear-store.ts` provides data-only slices and its codec; `gear-session-command.ts` composes Gear, discovery, materials, and live-run rebinding within one command. Choose its outer or draft wrapper using [Armory write paths](./ARMORY.md#write-paths).                                                  |
| Lifecycle                 | `run-session-lifecycle-port.ts` is the public seam over `run-lifecycle.ts`: restore, snapshot, battle sync, and teardown including presentation listeners and battle UI clearing. `finalizeRunEndSession` retains recap progress; `teardownRun` fully resets the live run.                                 |
| Settings actions          | `settings-store.ts`: `useSettingsActions` / `useAppSettings` for App chrome. Collection and Homestead commands use module-level `createRunSessionCommand` bindings beside their routes.                                                                                                                    |
| Route command composition | `shell/use-alchemy-run-controller.ts` composes the explicit contracts in `shell/route-commands.ts`.                                                                                                                                                                                                        |
| Navigation and rewards    | `shell/use-run-flow-engine.ts` wires React lifetime and display reads; `shell/run-flow-engine.ts` composes command factories. Start at `createRunFlow` in `run-loop/run/run-flow.ts`, its `run-flow-*.ts` modules, and `run-loop/navigation/mystery-event-navigation.ts` for destinations.                 |
| Mode entry                | Follow [run setup ownership](#run-setup-ownership) for mode selection, starter drafts, run-start snapshots, and Wildwood progression.                                                                                                                                                                      |
| Battle control            | `shell/use-battle-controller.ts` provides commands; `app/screen-routes/use-battle-playback.ts` owns route playback. See [Battle path](#battle-path).                                                                                                                                                       |
| Shops                     | `run-loop/shop/create-shop-actions.ts` composes the [shop command owners](#shop-commands).                                                                                                                                                                                                                 |
| Screen transitions        | `lib/routing/screen-transition-policy.ts` owns allowed edges; `shell/use-screen-transitions.ts` owns presentation timing.                                                                                                                                                                                  |

Controllers implement the explicit **command contracts** in `shell/route-commands.ts`; `use-alchemy-run-controller.ts` composes them. Shop and battle commands pass through directly, with shop continuation owned by run navigation. Screen contracts never derive from the composition root’s inferred return type. Screen routes own **display data** via their specific hooks. App chrome / autosave / particles read via capability hooks, not controller display re-exports. Imperative handlers read lifetime-specific ports at call time. Reward route commands expose `claimChoice(id)` and `skip()`: the reward command validates the offered ID and finalizes it atomically behind the claim guard. Card-only skipping explicitly finalizes with no choice, ignoring legacy persisted selection; `selectedId` remains save-compatible but no longer drives reward interaction. Battle refs and handlers travel through `routeCommands.battle`; battle display is read locally by the battle route. Battle-start commands derive gameplay and meta inputs from their open command draft instead of React controller props. Run-flow handlers take `RunFlowShellActions` and read gameplay fields from the command draft / read ports at call time. Pure destination routers take a `Pick` of those actions (`DestinationRouteDeps` in `run-destination-handlers.ts`); post-reward screen transitions live in `run-flow-rewards.ts` (`RewardRouteDeps`). Active-run core fields shared by committed session reads come from `pickActiveRunView` in `run-state-init.ts`.

Boot: [`use-alchemy-bootstrap.ts`](../src/app/use-alchemy-bootstrap.ts) applies persistence owners via `hydrateAlchemyPersistenceFields` and then calls the canonical `restoreRun` transition before publishing bootstrap readiness (guarded by `readRunInitialized`), so [`App.tsx`](../src/App.tsx) cannot render `AppInner` against an unhydrated run. [`bootstrap-save-state.ts`](../src/features/alchemy/shared/storage/bootstrap-save-state.ts) initializes Steam, configures the save backend from the returned capabilities, and only then loads candidates. `restoreRun` is the only runtime run-session hydration path; settings/profile/gear hydration flows through the persistence codecs first.

## Card inspection and combat equipment reservations

Card inspection keeps only `null | "deck" | "draw" | "discard"` in `ui-store`.
`useCardInspectionData` / `readCardInspectionData` expose the current run deck and
resolved battle collections through capability reads. App orchestration owns
visibility and transient focus, screen chrome carries the header action, and
battle pile actions travel through route/screen props. The shared overlay is
controlled and never reads gameplay stores. Manual battle input and automatic
playback recheck the UI gate at execution time.

Gear commands and Armory presentation share the derived combat reservation
policy from `gear-combat-restrictions.ts`, exposed by the Gear read owner. The
policy includes unfinished parked battles and ignores obsolete copies of the
foreground mode. It protects reserved loadouts and item mutations before any
resource or health changes. [ARMORY](./ARMORY.md#combat-equipment-restrictions)
owns the player-facing restriction; existing Talent/Homestead rebinding remains.

## Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

## Run setup ownership

`run-setup/run/content-system-navigation.ts` owns content-system selection,
character/difficulty routing, and resume. Run-start snapshots belong to
`run-start-command.ts`; wildcard starter-draft and novice Campaign helpers belong
to `shared/run-flow/starter-draft.ts` and `shared/run-flow/campaign-start.ts`.
Wildwood post-entry progression belongs to
`run-loop/run/wildwood-gauntlet-flow.ts`. The persisted draft/resume differences
between Campaign, Labyrinth, and Wildwood are covered by the [content-system
workflow](./WORKFLOWS.md#content-system-behavior).

`content-system-navigation.resumeRun` owns both mode-button resume and the shell's `returnToBattle` command. An explicit mode selects its slot; otherwise recency selects the last played run. Browsing another mode's setup creates no slot and does not promote that mode. Restoring a slot clears abandoned setup selections and returns to its saved screen, including unfinished rewards, shops, events, and drafts. No separate Labyrinth entry guard may block parked slots or regenerate their map.

Destination offer construction is pure in `shared/run-flow/destination-flow.ts`.
Callers supply offer history, boss ID, and command-bound RNG; destination
generation is not exposed through the content-system navigation API.

## Battle path

Controller composition supplies callbacks; screens do not construct controllers. Battle outcome handlers are constructed before the battle controller and passed directly, without ref-backed late binding. `shell/run-flow-engine.ts` composes framework-independent command factories; `use-run-flow-engine.ts` provides React lifetime and display reads:

```text
useAlchemyRunController → useBattleController → routeCommands.battle
App → RenderAlchemyScreen → BattleScreenRoute → BattleScreen (command props)
```

At interaction time, those callbacks resolve gameplay before presentation:

```text
BattleScreen action → supplied battle command → command draft → lib/battle
                    → committed snapshot + detached frames → presentation playback
BattleScreenRoute → useBattleScreenRouteData → displayed frame or committed snapshot
                  → useBattlePlayback → autoplay / auto-end-turn / bound playback refs
```

- `useAlchemyRunController` exposes battle **commands** on `routeCommands.battle`. Battle **display** is local to `BattleScreenRoute` via `useBattleScreenRouteData`, which selects the current presentation frame or the committed snapshot.
- Autoplay / auto-end-turn **ticks** live in `useBattlePlayback` on that route. Session autoplay on/off lives in `useBattleController`. Playback how-to: [WORKFLOWS § Change battle playback](./WORKFLOWS.md#change-battle-playback).
- Presentation leaves subscribe to `battle-presentation-store`. Teardown follows committed store `screen !== "battle"` (not `renderedScreen`). `App.tsx` passes `routeCommands` through `RenderAlchemyScreen`. Run/battle bindings stay on props; the allowed providers are `AppScreenChromeProvider` and `CardDescriptionProvider`, while presentation-only state may use `ui-store`. See [WORKFLOWS § Add a new card](./WORKFLOWS.md#add-a-new-card) for card-description context.

### Data flow

- **Card play:** UI → `useBattleController.playCard()` → `playBattleCardResolved()` → `applyCardEffects()` → new `BattleState` → store.
- **Combat feedback:** each presentation call is one resolved action batch. The presentation store copies and consolidates its events into ephemeral `CombatTextBurst` records (identity, target, typed entries, lifetime); burst state is never persisted or used for gameplay. Enemy-turn start, ability resolution, and separately presented Companion actions retain their batch boundaries, including immediate battle-ending presentation.
- **Enemy turn:** `commitEndTurn()` → `resolveBattleTurn(snapshot, context)` → committed result and XP → `playTurnFrames()` for presentation only.
- **Screen transition:** `navigateTo` → `transition` → `assertScreenTransitionAllowed()` → gameplay preparation and `session.activity` → delayed `navigation.screen` → `renderAlchemyScreenRoute()`. Interactive transitions use the exhaustive `ALLOWED_SCREEN_TRANSITIONS` table in `src/lib/routing/screen-transition-policy.ts`; boot restore/hydration bypasses that policy after save validation. `createScreenNavigation` validates the request and checks its guard before cancelling pending presentation. It runs `prepare` and commits the activity synchronously, so saves and subsequent commands see the completed gameplay even before the screen appears. Only presentation waits for `delayMs` or `NAVIGATION_DELAY_MS`; `immediate` takes precedence. A redirect during preparation supersedes the original request. Cancellation and hook unmount clear pending presentation timers without undoing completed gameplay. The rendered-screen fade runs independently and never commits gameplay; activity route data retains its outgoing snapshot for that fade.
- **Run-loop screens:** `screen-routes` call their screen-specific read hook for display props; `routeCommands` from the shell controller provide actions.
- **Navigation input:** `useScreenTransitions` exposes transient `navigationPending` through `AlchemyRunCommands`. It spans the prepared destination's presentation delay, clears on commit/cancellation, and is never persisted. App input remains inert until this flag clears, the rendered screen matches the committed screen, and mounted artwork is ready. Global Escape Back and menu-opening shortcuts follow the same gate; active dialogs and an already-open menu remain dismissible. Outgoing run-end summaries retain their screen data when teardown clears the live run.
- **Shell preload / autosave:** App warms `essentialGameArt` before reveal and starts the remaining per-item Gear art as soon as that essential preload settles; autosave and chrome read needed fields through capability modules. Critical UI sounds load eagerly. Battle initialization then prioritizes the visible hand and current enemy sounds; the remaining manifest decodes one item at a time during input-idle work so background audio warming cannot compete with interaction frames.

## Controller entry points

The [session capability reference](#session-capability-ports) lists controller, route, and domain entry points together. Use the [battle path](#battle-path), [shop commands](#shop-commands), and [run setup ownership](#run-setup-ownership) sections for their distinct execution contracts.

## Shop commands

`create-shop-actions.ts` composes the matching `*-shop-commands.ts` modules;
`shop-commands-core.ts` owns shared purchase and live refresh-price helpers.
Pure shelf samplers live in `shop-state-init.ts`, and draft recipes in
`shop-transactions.ts`. `runShopTransaction` / `commitShopInitialize` own dispatch:
payment, benefits, and visit changes commit together, and stale commands for
another shop are rejected. Gear writes inside that transaction follow
[Armory write paths](./ARMORY.md#write-paths).

Only the active visit is encoded by `encodePersistedShops`; presentation
navigation does not select the shelf to save. Kind `"merchant"` is the
player-facing **Card Shop**. For the editing sequence, refresh behavior, typed
shelf assignment, and modifier ordering, follow
[Change a shop](./WORKFLOWS.md#change-a-shop).

## Settings and meta profile

- `settings-store` owns synchronized display, audio, and gameplay preferences. It does not contain gameplay progression.
- `device-display-store` owns Game Size and Tooltip Size. Its storage seam writes a versioned device-local record, outside the settings save codec and Steam Cloud. Defaults load synchronously before layout; unavailable storage falls back to in-memory preferences. Options receives values and actions through its route props.
- `lib/settings-values.ts` owns the shared value sets and numeric bounds consumed by save validation, Options, audio,
  and the desktop bridge; the settings codec still owns defaults, encoding, and hydration.

Gameplay progression remains in the [aggregate regions](#run-state); persistence follows the [codec contract](#persistence-api). Run reward finalization uses the write and lifecycle ports (`finalizeRunXP`, `awardMaterialsDuringRun`), never the discovery-only profile region.

## Permanent Gear (`gear-store`)

Owned Gear and per-character loadouts live in `shared/stores/gear-store.ts`. Pure rules live under `src/lib/gear/`. Gear is meta progression, not copied into active-run data; battle snapshots `BattleState.gearEffects` and live meta mutations rebind via `rebindLiveRunMeta`. Feature code reads through `gear-store.ts`. Screen, mutations, and HP-sync: [ARMORY.md](./ARMORY.md). Authoring new items: [WORKFLOWS § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Types

`GameplayState` in `gameplay-state-store.ts` defines the [aggregate regions](#run-state). Read, write, command, and screen contracts are listed in the [capability reference](#session-capability-ports); persistence types are in the [codec contract](#persistence-api).

Initial progress and permanent fields, `ACTIVE_RUN_PROGRESS_KEYS`, and `pickActiveRunView` live in `run-state-init.ts`; `run-domain-types.ts` defines session, battle, and run-data fields. `profile-store-types.ts` and `gear-store-initial-state.ts` own their domains. Fresh-run snapshots live in `shared/run-flow/run-start.ts`. Shared numeric manifest defaults use `createNumericManifest` / `mergeNumericManifests` from `manifest-utils.ts`.

## Import boundaries

Enforced in `eslint.config.js` (composition in `eslint/fragments.js` + `eslint/boundaries.js`) and double-checked by `npm run lint:boundaries` (dependency-cruiser, except barrel deep-import bans which are eslint-only). Phase bans and flat-config stacking order live in those files; `npm run lint:architecture-smoke` (`scripts/lint-architecture-smoke.mjs`) asserts stacked `no-restricted-imports` fragments on representative files. Summary:

- `src/lib/**` must not import `@/features/**`
- Source modules must remain acyclic; reusable battle rules and reactions live below turn/card orchestrators
- `gameplay-state-store.ts` is internal to `shared/stores/`; other layers use capability hooks, reads, writes, commands, and lifecycle ports
- Feature code outside `shared/stores/` imports capability ports, commands, reads, writes, and lifecycle modules directly (not `run-lifecycle` internals)
- Screens must not import `run-loop/battle` or `run-loop/navigation` orchestration (screens may import `run-loop/battle/presentation/` leaves)
- `run-setup` ↛ `run-loop` and `run-loop` ↛ `run-setup` (shared helpers in `shared/run-flow/`)
- `meta` ↛ `run-loop` / `run-setup`

## Boot and loading

One loading experience at cold start, then navigation through the shared fade — no per-route "Loading …" fallbacks. Route and in-screen reveals hold the fade until mounted artwork has decoded; see [UI](./UI.md#screen-fade-motion).

| Layer     | Where                                                                          | Policy                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Images    | `essentialGameArt` in `assets.ts` (subset of the static `allGameArt` manifest) | Decoded in bounded batches (`IMAGE_PRELOAD_BATCH_SIZE`, `preloadImagesInBatches`) before reveal; per-image counts drive the startup bar |
| Fonts     | `use-app-effects.ts`                                                           | Ready with images before reveal                                                                                                         |
| Save      | `use-alchemy-bootstrap.ts`                                                     | Hydrated before reveal; included in startup bar target                                                                                  |
| Screen JS | `src/app/screen-routes/`                                                       | Static imports — **no** `React.lazy()`                                                                                                  |
| SFX       | `use-app-effects.ts`                                                           | Critical sounds eager; rest on idle                                                                                                     |

`StartupLoadingScreen` shows the wordmark filling left to right with the CTA gold (`text-primary`) over the 3s minimum display, rotating loading phrases below (`use-synced-loading-word.ts`) — no progress bar. The determinate readout lives on as the screen's `progressbar` ARIA value, still a smoothed meter of art decode, fonts, and save bootstrap (`startup-bar-progress.ts`) — not a timed CSS fill. Reveal waits until that work is done, the 3s minimum display has elapsed, **and** the eased display has caught 100%. Deferred per-item gear art starts decoding as soon as essential art settles so it overlaps the minimum window, continuing in the background after reveal if unfinished. The pre-React `index.html` track uses an indeterminate gold comet (no progress, no header) until React mounts.

**Do not add:** `React.lazy()` on route screens; lazy game art; per-screen spinners for assets in `allGameArt`.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only (`shouldSkipStartupLoadingGate()`).

Path-specific test commands: [CONTRIBUTING.md § What to run](../CONTRIBUTING.md#what-to-run-when-you-change).
