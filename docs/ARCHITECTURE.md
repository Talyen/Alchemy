# Alchemy architecture

Canonical reference for run state, store layout, and boot policy. Coding rules: [AGENTS.md](../AGENTS.md). Gameplay / battle rules: [REFERENCE.md § Battle](./REFERENCE.md#battle-implementation-rules). How-to: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

`src/lib/` stays React-free. Feature UI lives under `src/features/alchemy/`.

## Directory layout (`src/features/alchemy/`)

| Path         | Role                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| `shared/`    | `stores/`, `storage/`, `ui/`, `config/`, `utils/`, `run-flow/`, `types.ts` |
| `meta/`      | Menu, collection, homestead, talents, armory screens                       |
| `run-setup/` | Character, difficulty, draft screens                                       |
| `run-loop/`  | Battle glue, navigation, shop, in-run screens                              |
| `shell/`     | Controller hooks                                                           |

Import using on-disk paths (for example `@/features/alchemy/shared/stores/run-session-react-ports`). `src/lib/` stays React-free.

`shared/run-flow/` is the neutral seam for destination sampling and campaign-start helpers so `run-setup` and `run-loop` do not import each other (ESLint-enforced).

## Run state

Gameplay state has one authoritative nested Zustand aggregate in `shared/stores/gameplay-state-store.ts`. Its `run`, `session`, `battle`, `runProfile`, `profile`, and `gear` objects are the domain-shaped state; action groups sit beside those objects so commands cannot accidentally read or write another domain's fields. `profile-store.ts` and `gear-store.ts` are thin aggregate-backed persistence/adapter modules; they do not own shadow state. The capability ports are the feature-facing seams.

| Aggregate region | Concern                                                                                                | Lifetime                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `run`            | Active-run progression, navigation, parked mode snapshots (`parkedRuns`, `runRecency`)                 | Live run resets on teardown of that mode; other parked slots remain                                                   |
| `session`        | Rewards, shops, labyrinth, mystery visits, corruption results, pending selections, and run-flow claims | Transient per live run; shops, mystery visits, and corruption results persist on `ActiveRunData` via the resume codec |
| `battle`         | Combat snapshot, battle-start state, and display overrides                                             | Transient per battle; rebound from live meta on hydrate                                                               |
| `runProfile`     | Homestead, talent XP / unlocks, derived effects, and the shared gold purse                             | Profile lifetime                                                                                                      |
| `profile`        | Compendium discoveries and collection browsing state                                                   | Profile lifetime                                                                                                      |
| `gear`           | Permanent inventories, loadouts, and crafting currencies                                               | Profile lifetime                                                                                                      |

Cross-concern writes go through `run-session-write-port.ts`. Multi-concern lifecycle orchestration is exposed through `run-session-lifecycle-port.ts`. Feature-facing reads (`run-session-read-port`, `profile-store` / `gear-store` slices, and the React ports) are data-only; command-backed write ports own every gameplay mutation. React orchestration uses narrow ports from `run-session-react-ports.ts`; screens use exact screen-data hooks (battle display via `useBattleScreenRouteData`).

Gameplay mutation callers enter through `dispatchRunSessionCommand()` from `run-session-command.ts`. The command boundary opens one Immer draft of the authoritative aggregate, replaces the aggregate root with one incremented revision on success, and discards the draft on failure. React selectors and autosave subscribe to that same root. Settings and presentation-only state remain separate. Commands are synchronous and must not span an `await`; audio, navigation timers, presentation updates, and other non-rollbackable work use `afterCommit` or run after the command returns. Draft mutators receive the draft explicitly and compose inside one command; a command body must not call another command. Transactional checks that guard a write (shop gold, refresh counts, purchased slots) read from that same draft rather than a committed read port. Persistence adapters may subscribe to the aggregate commit signal directly; gameplay callers must not.

Battle reads are data-only. Battle writes use focused draft-first mutators from `run-session-write-port.ts`; event-time calls open one command and existing command recipes pass their draft explicitly. An asynchronous battle transition that changes logical state must persist its continuation in `activeCombat.pendingBattleTransition` in the same commit as its intermediate state. Presentation delays and display overrides may continue after that commit, but a booted battle must never depend on an in-memory promise or timer to become playable.

### Anti-patterns

- No all-screens display bag or second flattening read model. Each route owns its exact screen-specific hook (`RunScreenDataByScreen` in `run-screen-data.ts`).
- No command-in-command. Compose draft mutators inside one `dispatchRunSessionCommand`.
- No `Math.random()` for run or battle outcomes. Named run streams or `BattleState.rng` only.
- No React context for run/battle bindings. Controllers own **commands**; screen routes own **display data**.
- No mutable sibling-handler bag or hidden continuation dispatcher. Run-flow handlers take explicit callbacks via `RunFlowShellActions`.

### Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Command recipes obtain their generator through `createDraftRunRandomSource(draft, stream)` so counter advancement commits or rolls back with the resulting gameplay state. `createRunRandomSource(stream)` is reserved for the callback stored on `BattleState` and rebound during battle hydration. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw. Battle randomness remains owned by immutable `BattleState.rng`.

`Math.random()` is allowed only to create a fresh run seed or for cosmetic/meta-only effects.

| Concern                                               | Owner                                                  | Notes                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deck, HP, acts, trinkets                              | `gameplay-state-store.run.activeRun`                   | Persisted inside `activeRun` (and `parkedRuns` when another mode is live)                                                                                      |
| Gold                                                  | `gameplay-state-store.runProfile.gold`                 | One profile purse; shops, HUD, and battle read/write this field. `startGold` grants once on a new run start. Persisted `activeRun.runGold` is ignored on load. |
| Homestead + permanent talents                         | `gameplay-state-store.runProfile`                      | Persisted as top-level save fields; live HP / battle manifests rebind on mutation                                                                              |
| Rewards, shops, labyrinth, mystery visits, corruption | `gameplay-state-store.session`                         | Shops and corruption persist through the resume codec; mystery visits persist only while `currentScreen` is mystery                                            |
| Current `Screen`                                      | `gameplay-state-store.run.navigation`                  | `useActiveRunScreenValue()`                                                                                                                                    |
| Combat snapshot + display overrides                   | `gameplay-state-store.battle`                          | Synced during battle                                                                                                                                           |
| Battle VFX                                            | `run-loop/battle/battle-presentation-store.ts`         | Not persisted                                                                                                                                                  |
| Lifecycle                                             | `run-session-lifecycle-port.ts` → `run-transitions.ts` | Restore, snapshot, teardown, battle sync                                                                                                                       |

### Persistence API

| API                                    | Role                                                                                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encodeRunResumeSnapshot(source)`      | Sole `RunSession` → `ActiveRunData` assembler (content-system nulling, `activeCombat`, resume semantics). Private helper: `encodeActiveRunFromSession`. Hydrate uses `toActiveRunData` in `lib/active-run-session/parse.ts`. |
| `decodeRunResumeSnapshot(data)`        | Translate `ActiveRunData` → aggregate session fields                                                                                                                                                                         |
| `snapshotRun(screen?)`                 | Read aggregate run state through the codec                                                                                                                                                                                   |
| `restoreRun(…)`                        | Apply the decoded snapshot on boot/resume (incl. trinket-manifest repair)                                                                                                                                                    |
| `parseActiveRun(raw)`                  | Validate JSON before hydrate                                                                                                                                                                                                 |
| `PersistedBattleStateSchema`           | Single BattleState wire parse + default merge                                                                                                                                                                                |
| `activeCombat.pendingBattleTransition` | Resume an interrupted enemy-turn continuation                                                                                                                                                                                |
| Domain persistence codecs              | Own defaults, encode, hydrate, and subscriptions                                                                                                                                                                             |
| Persistence coordinator                | Compose domain fields into the versioned envelope                                                                                                                                                                            |
| `platform-save-backend.ts`             | Browser/Desktop transport, backup/cloud candidate order, and recoverable write/clear ordering                                                                                                                                |

`shared/storage/io.ts` owns save parsing, validation, future-version protection, and write serialization. It delegates raw persistence to one `SaveBackend` configured during bootstrap. `initializeSteam()` returns an explicit `cloudSyncEnabled` capability; it does not mutate shared platform state. The platform backend always considers Steam Cloud as the final desktop read fallback, writes the local backup-ring file before a non-blocking cloud mirror, and deletes cloud before local data so a failed cloud deletion leaves recoverable local candidates intact.

### Session capability ports

| Kind                         | Module                                                                         | Role                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Reads (imperative)           | `run-session-read-port.ts`                                                     | Data-only `readActiveRun()`, `readRunProfile()`, `readRunSession()`, `readBattle()`, `readShopFirstPurchaseUsed()`       |
| Reads (React, screen)        | `use-run-screen-data.ts` + `app/screen-routes/use-battle-screen-route-data.ts` | Exact route display contracts; battle display is `useBattleScreenRouteData`, which composes `useRunSessionBattleContext` |
| Reads (React, orchestration) | `run-session-model.ts`                                                         | `useRunSessionNavigationSlice`; `useRunSessionBattleContext` is a display composable, not a shell command source         |
| Reads (React, meta/setup)    | `run-session-react-ports.ts`                                                   | Homestead/talent/draft slices, `useRunOrchestrationPort`, `useBattleRunPort`                                             |
| React action selectors       | `store-actions.ts`                                                             | Settings, collection, and homestead command selectors for App chrome                                                     |
| Writes                       | `run-session-write-port.ts` + `dispatchRunSessionCommand`                      | Draft mutators; first argument is `GameplayDraft`. `update*` = functional, `set*` = value                                |
| Battle writes                | `run-session-write-port.ts`                                                    | `setBattleState`, `beginBattleTransition`, `commitBattleTransition`; `readBattle()` is data-only                         |
| Lifecycle                    | `run-session-lifecycle-port.ts`                                                | Public seam over `run-transitions.ts`                                                                                    |
| Commit                       | `run-session-command.ts`                                                       | One Immer draft, one published revision; no second read store                                                            |

Controllers own **commands**; `use-alchemy-run-controller.ts` assembles the phase-scoped `routeCommands` tree at the shell composition root. Screen routes own **display data** via their specific hooks. App chrome / autosave / particles read via capability hooks, not controller display re-exports. Imperative handlers read lifetime-specific ports at call time. Battle refs and handlers travel through `routeCommands.battle`; battle display is read locally by the battle route. Battle controllers take narrow `BattleRunPort` / `BattleTalentPort` inputs. Run-flow handlers take `RunFlowShellActions` and read gameplay fields from the command draft / read ports at call time. Pure destination routers take a `Pick` of those actions (`DestinationRouteDeps`); post-reward screen transitions live in `run-flow-rewards.ts` (`RewardRouteDeps`). Active-run core fields shared by committed session reads come from `pickActiveRunView` in `run-state-init.ts`.

Boot: [`use-alchemy-bootstrap.ts`](../src/app/use-alchemy-bootstrap.ts) applies persistence owners and calls the canonical `restoreRun` transition before publishing bootstrap readiness (guarded by `readRunInitialized`), so [`App.tsx`](../src/App.tsx) cannot render `AppInner` against an unhydrated run. [`bootstrap-save-state.ts`](../src/features/alchemy/shared/storage/bootstrap-save-state.ts) initializes Steam, configures the save backend from the returned capabilities, and only then loads candidates. `restoreRun` is the only runtime hydration path. `run-resume-codec.ts` is the single feature-owned translation boundary for save/resume state; `restore-active-run-session.ts` only applies its decoded session fields through the aggregate session action group.

### Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

### Run setup ownership

`run-setup/run/content-system-navigation.ts` owns content-system selection, character/difficulty routing, and resume. Run-start snapshots live in `content-system-run-init.ts` and use the draft-only helper in `run-start-command.ts`; event handlers own the surrounding command and post-commit effects. Campaign and labyrinth Wildcard drafting is a persisted run phase: the first three-card offer is rolled from the `rewards` stream, `hasActiveRun` is true, and `session.starterDraftChoices` plus `runDeck` resume the same pack. Wildwood setup ends once its persisted draft is created. From the first draft pick onward, `shell/use-wildwood-gauntlet-flow.ts` is the sole owner of Wildwood draft completion, boss progression, rewards, and resume routing.

Destination offer construction is pure in `shared/run-flow/destination-flow.ts`. Campaign start and run-loop progression supply explicit offer history, boss ID, and command-bound RNG; destination generation is not exposed through the content-system navigation API.

## Battle path

```
Screen route → routeCommands.battle (props) → BattleScreen
           → useAlchemyRunController → useBattleController (BattleRunPort / BattleTalentPort)
           → run-loop/battle/* → run-session-read-port / run-session-command → lib/battle
BattleScreenRoute → useBattleScreenRouteData (committed battle display)
                 → useBattlePlayback (autoplay / auto-end-turn; binds refs via commands.bindPlayback)
                 → battle/presentation/* leaves subscribe to battle-presentation-store
```

`useAlchemyRunController` exposes battle **commands** on `routeCommands.battle` (refs + handlers). Battle display state is read locally in `BattleScreenRoute` via `useBattleScreenRouteData`. Autoplay **ticks** live in `useBattlePlayback` on that route so combat ticks do not re-render the shell controller; session autoplay on/off lives in `useBattleController` so it survives route unmount. Enabling autoplay also turns on auto-end-turn for that session (`autoEndTurn || isAutoplayEnabled`), even when the settings toggle is off. Playback reads presentation-store transfer/hidden-hand flags through `use-battle-presentation-gate.ts` (`subscribe`/`getState`, no route re-render). `useBattlePlayback` owns one gate subscription and passes the ref into autoplay and auto-end-turn. Gate changes wake auto-end immediately and interrupt autoplay's retry wait so post-draw playback does not wait a full retry interval. After enemy/haste draw (and mid-turn resume), end-turn orchestration also calls `scheduleAutoEndTurn` explicitly: auto-end does not reschedule from `battleState` React ticks alone. `hiddenHandCardKeys` is an immutable sorted string list (identity changes iff membership changes) so the hand selector and playback gate can use `Object.is`. Hidden-hand blocking is an intersection with the current hand — orphaned keys do not soft-lock autoplay or auto-end-turn. Manual card play, End Turn, and hand playability use the same transfer / in-progress idle gate (`isBattlePlayInputBusy`) as playback, so a visible card cannot commit during draw/discard FX. `bindPlayback` copies those callbacks into controller refs; first combat entry remounts the route so preferred-autoplay `useState` init covers the session-prepared callback that `startBattle` fires before navigate. `App.tsx` passes `routeCommands` through `RenderAlchemyScreen` → `run-loop-routes` — no React context and no separate `battleBindings` channel.

`useBattleController` builds session/transfer/end-turn/card-play factories from a shared context; end-turn orchestration takes session + transfer helpers and calls write-port commands directly. Presentation teardown follows the **committed** store `screen !== "battle"` (not `renderedScreen`), so VFX can clear while the battle route is still fading out. Victory delays `setScreen` until after the death animation (`VICTORY_TRANSITION_DELAY`, collapsed by `resolveGameDelay` in fast mode). Auto-end and autoplay retry delays also use `resolveGameDelay`; `NAVIGATION_DELAY_MS` does not. See [`animation-prefs.ts`](../src/lib/animation/animation-prefs.ts).

Battle glue writes VFX through `BattlePresentationPort` (`resolveBattlePresentation()` in production; tests may inject a stub). React leaves under `run-loop/battle/presentation/` subscribe to `battle-presentation-store`. Global card hover/shimmer uses `ui-store`. Haste empty-draw clears `hiddenHandCardKeys` so autoplay/auto-end-turn are not blocked by leftover discard hides. Mid-enemy-turn reload still skips draw/discard replay.

### Data flow

- **Card play:** UI → `useBattleController.playCard()` → `playBattleCardResolved()` → `applyCardEffects()` → new `BattleState` → store.
- **Enemy turn:** `endPlayerTurn()` → one committed intermediate state + persisted continuation → presentation delays → one committed result state.
- **Screen transition:** `navigateTo` → `assertScreenTransitionAllowed()` → `navigation.screen` → `renderAlchemyScreenRoute()`. Interactive transitions are governed by the exhaustive `ALLOWED_SCREEN_TRANSITIONS` table in `src/lib/routing/screen-transition-policy.ts`; boot restore/hydration intentionally bypasses that policy after save validation.
- **Run-loop screens:** `screen-routes` call their screen-specific read hook for display props; `routeCommands` from the shell controller provide actions.
- **Shell preload / autosave:** App warms the centralized `allGameArt` manifest before reveal; autosave and chrome read needed fields through capability modules. Critical UI sounds load eagerly. Battle initialization then prioritizes the visible hand and current enemy sounds; the remaining manifest decodes one item at a time during input-idle work so background audio warming cannot compete with interaction frames.

## Controller entry points

| Concern                 | Start here                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run lifecycle           | `shell/use-alchemy-run-controller.ts`, `run-session-lifecycle-port.ts`                                                                                                                                                                                   |
| Route command maps      | `shell/use-alchemy-run-controller.ts` composition root                                                                                                                                                                                                   |
| Navigation / rewards    | `shell/use-run-flow-engine.ts` (React wiring) + `createRunFlowHandlers` / `run-loop/run/run-flow-*.ts` + `shell/use-mystery-event-navigation.ts` + `run-loop/navigation/*`                                                                               |
| Content-system entry    | `run-setup/run/content-system-navigation.ts` + `content-system-run-init.ts` → `run-start-command.ts`; campaign/labyrinth Wildcard draft uses `shared/run-flow/starter-draft.ts`; Wildwood post-entry flow stays in `shell/use-wildwood-gauntlet-flow.ts` |
| Run-flow shell actions  | `run-loop/run/run-flow-shell-actions.ts` (assembled in `shell/use-run-flow-engine.ts`); destination routers use `DestinationRouteDeps`; reward routing uses `RewardRouteDeps` in `run-flow-rewards.ts`                                                   |
| Run-flow / battle ports | `shared/stores/run-port-types.ts` (`BattleRunPort`, `BattleTalentPort`, …)                                                                                                                                                                               |
| Battle                  | `shell/use-battle-controller.ts` + `app/screen-routes/use-battle-playback.ts` → `lib/battle/*`                                                                                                                                                           |
| Shops                   | `shell/use-shop-controller.ts` → `run-loop/shop/create-shop-actions.ts` → domain command modules                                                                                                                                                         |
| Session reads/writes    | `shared/stores/run-session-read-port.ts`, `run-session-write-port.ts`, `run-session-command.ts`                                                                                                                                                          |
| Screen routing          | `lib/routing/screen-transition-policy.ts`, `shell/use-screen-transitions.ts`, `useActiveRunScreenValue()`                                                                                                                                                |

## Shop commands

`create-shop-actions.ts` is composition only. Each shop's initialization, purchases, services, refreshes, and live price selectors belong to its matching `*-shop-commands.ts` module. Draft recipes in `run-loop/shop/shop-transactions.ts` (`purchaseShopOffering`, `refreshShopOfferings`, `refreshCardShopOfferings`) operate on the active command draft and return `ShopTransactionResult`. Wrappers `runShopTransaction` and `commitShopInitialize` are the dispatch seam and play spend SFX after a successful paid commit. Slot identity helpers live in `shop-slot-keys.ts` so screens do not import the command/audio module. Merchant's Favor (`firstPurchaseUsed`) applies to the first purchase of each shop **visit**; `initialize` resets that flag with `empty*State()`. Equipment acquisition in `equipment-shop-commands.ts` must use `mutateGearWithRunHealthSync` **inside** the shop command draft so permanent Gear and active-run health commit atomically. Use `dispatchGearMutationWithRunHealthSync()` only when not already inside a command (nested dispatch is illegal).

## Settings and meta profile

- `settings-store` owns display, audio, and gameplay preferences. It does not contain gameplay progression.
- `profile-store` owns compendium discoveries, completed difficulties, finished-run characters, and transient collection browsing state.
- `gameplay-state-store.runProfile` owns homestead and talent progression. Run reward finalization writes through `run-session-write-port` (`finalizeRunXP`, `awardMaterialsDuringRun`, …) and lifecycle ports — do not merge this into `profile`.
- `gear-store` owns the permanent Gear subdomain and its invariants.

Each persistence owner exposes a codec beside its aggregate region. The codec owns that domain's save-field contract, defaults, encoding, and hydration. `shared/storage/persistence-coordinator.ts` composes those codecs and subscribes to the settings codec plus the aggregate commit signal. Feature code uses the owning capability port.

## Permanent Gear (`gear-store`)

Owned Gear instances and per-character loadouts live in `shared/stores/gear-store.ts`. Definitions and pure equip/salvage/effect rules live under `src/lib/gear/`. Gear is permanent meta progression and is not copied into active-run data. Battle creation snapshots the selected character's Gear effects into `BattleState.gearEffects`; Armory, talent, and homestead mutations rebind the live fight immediately via `rebindLiveRunMeta`. Parked runs pick up the same manifests on hydrate.

Run-loop / run-setup / shell read gear through `gear-store.ts` (`readGearManifestForCharacter`, `readHasAnyOwnedGear`, `useGearArmorySlice`, …). Mutations that affect HP enter through `dispatchGearMutationWithRunHealthSync()`. Each Gear instance may be equipped on at most one character at a time. The Armory stays editable during combat. See [ARMORY.md](./ARMORY.md) for the data model, click-to-equip screen, and tests.

## Types

| Concern                    | Module                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregate fields + actions | `gameplay-state-store.ts`                                                                                                              |
| Imperative reads           | `run-session-read-port.ts`                                                                                                             |
| Draft mutators             | `run-session-write-port.ts` (re-exports `write-port-run.ts`, `write-port-session.ts`, `write-port-battle.ts`, `write-port-profile.ts`) |
| React ports                | `run-session-react-ports.ts`, `run-port-types.ts`                                                                                      |
| Screen display contracts   | `run-screen-data.ts`, `use-run-screen-data.ts`; battle: `app/screen-routes/use-battle-screen-route-data.ts`                            |
| Atomic commit              | `run-session-command.ts` (`dispatchRunSessionCommand`)                                                                                 |
| Active-run view helpers    | `run-state-init.ts` (`pickActiveRunView`)                                                                                              |
| Fresh-run snapshots        | `shared/run-flow/run-start.ts`                                                                                                         |

Gameplay mutations use the command boundary; persistence codecs receive a draft from the coordinator for hydration. Feature code imports narrow ports, commands, reads, writes, and lifecycle directly from their owning modules.

## Import boundaries

Enforced in `eslint.config.js` (composition in `eslint/fragments.js` + `eslint/boundaries.js`) and double-checked by `npm run lint:boundaries` (dependency-cruiser). Phase bans and flat-config stacking order live in those files; `npm run lint:architecture-smoke` (`scripts/lint-architecture-smoke.mjs`) asserts stacked `no-restricted-imports` fragments on representative files. Summary:

- `src/lib/**` must not import `@/features/**`
- `gameplay-state-store.ts` is internal to `shared/stores/`; other layers use capability hooks, reads, writes, commands, and lifecycle ports
- Feature code outside `shared/stores/` imports capability ports, commands, reads, writes, and lifecycle modules directly (not `run-transitions`)
- Screens must not import `run-loop/battle` or `run-loop/navigation` orchestration (screens may import `run-loop/battle/presentation/` leaves)
- `run-setup` ↛ `run-loop` and `run-loop` ↛ `run-setup` (shared helpers in `shared/run-flow/`)
- `meta` ↛ `run-loop` / `run-setup`

## Boot and loading

One loading experience at cold start, then instant navigation — no per-route "Loading …" fallbacks.

| Layer     | Where                                                  | Policy                                                                           |
| --------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Images    | `allGameArt` in `assets.ts` (eager `import.meta.glob`) | Decoded in bounded batches before reveal; per-image counts drive the startup bar |
| Fonts     | `use-app-effects.ts`                                   | Ready with images before reveal                                                  |
| Save      | `use-alchemy-bootstrap.ts`                             | Hydrated before reveal; included in startup bar target                           |
| Screen JS | `src/app/screen-routes/`                               | Static imports — **no** `React.lazy()`                                           |
| SFX       | `use-app-effects.ts`                                   | Critical sounds eager; rest on idle                                              |

The cold-start bar in `StartupLoadingScreen` is a smoothed meter of art decode, fonts, and save bootstrap (`startup-bar-progress.ts`) — not a timed CSS fill. Reveal waits until that work is done **and** the eased display has caught 100%. The pre-React `index.html` track uses an indeterminate gold comet (no progress) until React mounts and owns the real fill.

**Do not add:** `React.lazy()` on route screens; lazy game art; per-screen spinners for assets in `allGameArt`.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only (`shouldSkipStartupLoadingGate()`).

Path-specific test commands: [CONTRIBUTING.md § What to run](../CONTRIBUTING.md#what-to-run-when-you-change).
