# Alchemy architecture

Canonical reference for run state, store layout, and boot policy. Coding rules: [AGENTS.md](../AGENTS.md). Gameplay / battle rules: [REFERENCE.md § Battle](./REFERENCE.md#battle-implementation-rules). How-to: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

`src/lib/` stays React-free: `battle/`, `game-data/`, `content-systems/`, `homestead/`, `validation/`, `game-constants.ts`, audio modules.

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

Gameplay state has one authoritative nested Zustand aggregate in `shared/stores/gameplay-state-store.ts`. Its `run`, `session`, `battle`, `runProfile`, `profile`, and `gear` objects are the domain-shaped state; action groups sit beside those objects so commands cannot accidentally read or write another domain's fields. The former run-lifetime stores and aggregate query projection are removed. `profile-store.ts` and `gear-store.ts` remain thin aggregate-backed persistence/adapter modules for their established external contracts; they do not own shadow state. The capability ports are the feature-facing seams.

| Aggregate region | Concern                                                                      | Lifetime              |
| ---------------- | ---------------------------------------------------------------------------- | --------------------- |
| `run`            | Active-run progression and navigation (`activeRun`, `initialized`, `screen`) | Reset by run teardown |
| `session`        | Rewards, shops, labyrinth, mystery, pending selections, and run-flow claims  | Transient per run     |
| `battle`         | Combat snapshot, battle-start state, and display overrides                   | Transient per battle  |
| `runProfile`     | Homestead, talent XP / unlocks, and derived effects                          | Meta lifetime         |
| `profile`        | Compendium discoveries and collection browsing state                         | Profile lifetime      |
| `gear`           | Permanent inventories, loadouts, board positions, and crafting currencies    | Profile lifetime      |

Cross-concern writes go through `run-session-write-port.ts` (active-run progression, profile/homestead, battle transitions, rewards, shops, labyrinth, mystery, and run setup). Multi-concern lifecycle orchestration is exposed through `run-session-lifecycle-port.ts`. Feature-facing reads (`run-session-read-port`, `profile-store` / `gear-store` slices, and the React ports) are data-only, while command-backed write ports own every gameplay mutation. React orchestration uses narrow ports from `run-session-react-ports.ts` such as `useRunOrchestrationPort` and `useBattleRunPort`; screens use exact screen-data hooks (battle display via `useBattleScreenRouteData`). Profile and gear live in their domain store modules (persistence + feature slices); no caller receives a cross-lifetime flattened view.

Gameplay mutation callers enter the session through `dispatchRunSessionCommand()` from `run-session-command.ts`. The command boundary opens an Immer draft of the authoritative aggregate, publishes one root revision on success, and discards the draft on failure. React selectors and autosave subscribe to that same root; there is no committed compatibility snapshot to drift from it. Settings and presentation-only state remain separate. Commands are synchronous and must not span an `await`; audio, navigation timers, presentation updates, and other non-rollbackable work use the command's `afterCommit` option or run after the command returns. Nested commands defer their effects until the outer commit, and discard them if any nested work fails. Persistence adapters may subscribe to the aggregate commit signal directly; gameplay callers must not.

Battle reads are data-only: `run-session-read-port.ts` does not expose aggregate mutators. Battle writes use focused commands from `run-session-write-port.ts`, which preserve the synchronous command boundary even when called from an existing command. An asynchronous battle transition that changes logical state must persist its continuation in `activeCombat.pendingBattleTransition` in the same commit as its intermediate state. Presentation delays and display overrides may continue after that commit, but a booted battle must never depend on an in-memory promise or timer to become playable.

### Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Feature orchestration obtains command-backed generators through `createRunRandomSource(stream)` from the write port, and consumes them inside the command that commits the resulting gameplay state. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw. Battle randomness remains owned by immutable `BattleState.rng`.

`Math.random()` is allowed only to create a fresh run seed or for cosmetic/meta-only effects. Run outcomes must use a named run stream; battle outcomes must use `BattleState.rng`.

| Concern                             | Owner                                                  | Notes                                    |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Deck, gold, HP, acts, trinkets      | `gameplay-state-store.run.activeRun`                   | Persisted inside `activeRun`             |
| Homestead + permanent talents       | `gameplay-state-store.runProfile`                      | Persisted as top-level save fields       |
| Rewards, shops, labyrinth, mystery  | `gameplay-state-store.session`                         | Transient per run                        |
| Current `Screen`                    | `gameplay-state-store.run.navigation`                  | `useActiveRunScreen()`                   |
| Combat snapshot + display overrides | `gameplay-state-store.battle`                          | Synced during battle                     |
| Battle VFX                          | `battle-presentation-store`                            | Not persisted                            |
| Lifecycle                           | `run-session-lifecycle-port.ts` → `run-transitions.ts` | Restore, snapshot, teardown, battle sync |

### Persistence API

| API                                    | Role                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `createActiveRunSnapshot(source)`      | Sole field→`ActiveRunData` assembler (content-system nulling + `activeCombat`)                 |
| `encodeRunResumeSnapshot(source)`      | Resume semantics (screen, interrupted flow, shops) then snapshot via `ActiveRunSnapshotSource` |
| `decodeRunResumeSnapshot(data)`        | Translate `ActiveRunData` → aggregate session fields                                           |
| `snapshotRun(screen?)`                 | Read aggregate run state through the codec                                                     |
| `restoreRun(…)`                        | Apply the decoded snapshot on boot/resume (incl. trinket-manifest repair)                      |
| `parseActiveRun(raw)`                  | Validate JSON before hydrate                                                                   |
| `PersistedBattleStateSchema`           | Single BattleState wire parse + default merge                                                  |
| `activeCombat.pendingBattleTransition` | Resume an interrupted enemy-turn continuation                                                  |
| Domain persistence codecs              | Own defaults, encode, hydrate, and subscriptions                                               |
| Persistence coordinator                | Compose domain fields into the versioned envelope                                              |

### Session capability ports

- **Reads (imperative):** `run-session-read-port.ts` exposes data-only `readActiveRun()`, `readRunProfile()`, `readRunSession()`, and `readBattle()` — for handlers, lifecycle, and non-React code
- **Reads (React, screen-scoped):** screen-specific hooks in `use-run-screen-data.ts` (for example `useShopScreenData`, `useRewardsScreenData`, and `useGameOverScreenData`) — each hook selects directly from the aggregate and returns only its route's exact display contract
- **Reads (React, orchestration):** `useRunSessionNavigationSlice(screen)`, `useRunSessionBattleContext(screen)` from `run-session-model.ts` — both select directly from the aggregate; do not mirror screen display fields
- **Reads (React, meta/setup):** focused selectors and narrow orchestration ports from `run-session-react-ports.ts` (`useHomesteadProgressSlice`, `useTalentProgressSlice`, `useDraftDeckSlice`, `useRunOrchestrationPort`, `useBattleRunPort`, …); these select from the aggregate and expose only the fields needed by one owner
- **Writes:** `dispatchRunSessionCommand` and the command-backed helpers in `run-session-write-port.ts` (`setRewardState`, `setShopState`, labyrinth/mystery setters, run progression, profile awards, …). Port mutators that accept a functional update (`value | (previous) => next`) use an `update*` prefix (`updateRunDeck`, `updateCurrentAct`) to distinguish them from plain-value `set*` setters (`setScreen`, `setCharacter`); both are command-backed wrappers that re-read committed state and are safe to call from event-time handlers.
- **Battle writes:** `setBattleState`, `beginBattleTransition`, `commitBattleTransition`, and related commands from `run-session-write-port.ts`; `readBattle()` is intentionally data-only
- **Hooks:** `useActiveRunScreen()`, screen-specific display hooks, and the navigation/battle context slices above
- **Lifecycle:** `run-session-lifecycle-port.ts` owns the public lifecycle seam over `run-transitions.ts`
- **Composed views:** there is no all-domain projection module. `run-session-read-port.ts` exposes action-free lifetime reads, `run-session-react-ports.ts` owns narrow React ports, and `run-session-write-port.ts` owns mutation capabilities. `run-session-command.ts` coordinates atomic aggregate commits (Immer draft + one published revision); it does not publish a second read store.

**Do not add** a broad all-screens display bag or a second flattening read model. Each route owns its exact screen-specific hook; the shared `RunScreenDataByScreen` map in `run-screen-data.ts` keeps those contracts explicit. Controllers own **commands** (assembled by `shell/create-route-commands.ts`); screen routes own **display data** via their specific hooks. The asset preloader uses the intentionally small `useScreenAssetPreloadData` projection because it spans several possible screens. App chrome / autosave / particles read via capability hooks (`useActiveRunCharacterId`, `useTalentProgressSlice`, `useRunSessionBattleContext`, …), not controller display re-exports. Imperative handlers read lifetime-specific ports (`readActiveRun`, `readRunProfile`, `readRunSession`, `readBattle`) at call time; they do not receive a React controller data bus. Battle presentation and actions share `routeCommands.battle` (screen data, refs, transfers, and handlers) and take narrow `BattleRunPort` / `BattleTalentPort` inputs. Run-flow handlers take narrow `RunFlowRunPort` / `RunFlowTalentPort`, call shell side effects through `RunFlowShellActions` (assembled once in `use-run-flow-engine.ts` from battle/shop/labyrinth/wildwood/mystery callbacks — not parallel NavOps bags), and call sibling concern handlers directly via a shared `RunFlowSiblingHandlers` object. Pure destination/reward routers take a `Pick` of those shell actions (plus write-port or sibling extras only where needed): `DestinationRouteDeps` and `RewardRouteDeps`. Active-run core fields shared by committed session reads come from `pickActiveRunView` in `run-state-init.ts`.

Boot: [`App.tsx`](../src/App.tsx) calls the canonical `restoreRun` transition after bootstrap and before first paint (guarded by `readRunInitialized`) so the first rendered screen is already resumed. `restoreRun` is the only runtime hydration path. `run-resume-codec.ts` is the single feature-owned translation boundary for save/resume state; `restore-active-run-session.ts` only applies its decoded session fields through the aggregate session action group, so autosave and boot hydration cannot grow separate field mappings. The mega-controller wires domain controllers into `createAlchemyRouteCommands` (including battle presentation on `routeCommands.battle`); it is not a display-data bus.

### Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

## Battle path

```
Screen route → routeCommands.battle (props) → BattleScreen
           → useAlchemyRunController → useBattleController (BattleRunPort / BattleTalentPort)
           → run-loop/battle/* → run-session-read-port / run-session-command → lib/battle
```

`useAlchemyRunController` exposes battle **commands** on `routeCommands.battle` (refs + handlers). Battle display state is read locally in `BattleScreenRoute` via `useBattleScreenRouteData`. `App.tsx` passes `routeCommands` through `RenderAlchemyScreen` → `run-loop-routes` — no React context and no separate `battleBindings` channel.

`useBattleController` builds session/transfer/end-turn/card-play factories from a shared context; end-turn orchestration takes session + transfer helpers and calls write-port commands directly (no write-port re-bundle on a deps object).

Presentation VFX uses `battle-presentation-store` only. Global card hover/shimmer uses `ui-store`.

### Data flow

- **Card play:** UI → `useBattleController.playCard()` → `playBattleCardResolved()` → `applyCardEffects()` → new `BattleState` → store.
- **Enemy turn:** `endPlayerTurn()` → one committed intermediate state + persisted continuation → presentation delays → one committed result state.
- **Screen transition:** `navigateTo` → `navigation.screen` → `renderAlchemyScreenRoute()`.
- **Run-loop screens:** `screen-routes` call their screen-specific read hook for display props; `routeCommands` from the shell controller provide actions — no second data bus through `useAlchemyRunController` for shop/rewards/mystery/labyrinth fields.
- **Shell preload / autosave:** App reads needed fields via capability modules (`useScreenAssetPreloadData`, battle context, and the relevant exact screen hook), not controller state re-exports.

## Controller entry points

| Concern                 | Start here                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run lifecycle           | `shell/use-alchemy-run-controller.ts`, `run-session-lifecycle-port.ts`                                                                               |
| Route command maps      | `shell/create-route-commands.ts`                                                                                                                     |
| Navigation / rewards    | `shell/use-run-flow-engine.ts` (destination/content/mystery hooks + inlined flow factories) + `run-loop/navigation/*` / `run-loop/run/*`             |
| Run-flow shell actions  | `run-loop/run/run-flow-shell-actions.ts` (assembled in `shell/use-run-flow-engine.ts`); routers use `DestinationRouteDeps` / `RewardRouteDeps` picks |
| Run-flow / battle ports | `shared/stores/run-port-types.ts` (`RunFlowRunPort`, `BattleRunPort`, …)                                                                             |
| Battle                  | `shell/use-battle-controller.ts` → `lib/battle/*`                                                                                                    |
| Session reads/writes    | `shared/stores/run-session-read-port.ts`, `run-session-write-port.ts`, `run-session-command.ts`                                                      |
| Screen routing          | `shell/use-screen-transitions.ts`, `useActiveRunScreen()`                                                                                            |

## Settings and meta profile

- `settings-store` owns display, audio, and gameplay preferences. It does not contain gameplay progression.
- `profile-store` owns compendium discoveries, completed difficulties, finished-run characters, and transient collection browsing state.
- `gameplay-state-store.runProfile` owns homestead and talent progression. Run reward finalization writes through `run-session-write-port` (`finalizeRunXP`, `awardMaterialsDuringRun`, …) and lifecycle ports — do not merge this into `profile`.
- `gear-store` owns the permanent Gear subdomain and its invariants.

Each persistence owner exposes a codec beside its aggregate region. The codec owns that domain's save-field contract, defaults, encoding, and hydration. `shared/storage/persistence-coordinator.ts` composes those codecs and subscribes to the settings codec plus the aggregate commit signal; it contains no field-by-field store mapping. Feature code uses the owning capability port.

## Permanent Gear (`gear-store`)

Owned Gear instances and per-character loadouts live in `shared/stores/gear-store.ts`. Definitions and pure equip/salvage/effect rules live under `src/lib/gear/`. Gear is permanent meta progression and is not copied into active-run data; battle creation snapshots the selected character's aggregate Gear effects into the immutable battle talent manifest.

Run-loop / run-setup / shell read gear through `shared/stores/gear-store.ts` (`readGearManifestForCharacter`, `readHasAnyOwnedGear`, `useGearArmorySlice`, …) instead of reaching into the full store API. Mutations enter through `dispatchGearMutationWithRunHealthSync()` so active-run health is derived from the same before/after Gear snapshot and committed with the Gear mutation. Autosave observes the single aggregate commit signal.

Each Gear instance may be equipped on at most one character at a time (one slot per loadout). Equipping moves the instance off any other character or slot. Armory editing is disabled while a battle is active. Autosave subscribes to the Gear store and uses the transient Return to Run screen when meta screens are opened during a run. See [ARMORY.md](./ARMORY.md) for the data model, state flow, board-packing rules, drag FSM, battle integration, and tests map.

## Types

Aggregate fields and action wiring live in `gameplay-state-store.ts`; action-free feature reads live in `run-session-read-port.ts` and command-backed mutations live in `run-session-write-port.ts`. React orchestration ports live in `run-session-react-ports.ts` and `run-port-types.ts`. Exact screen display contracts live in `run-screen-data.ts` (`RunScreenDataByScreen`); screen-specific React selectors live in `use-run-screen-data.ts` — do not recreate a broad all-screen bag or parallel flatten twin. `run-session-command.ts` is the atomic commit coordinator over the nested aggregate root (`dispatchRunSessionCommand`). Gameplay mutations use that command boundary; only persistence adapters and the command implementation should depend on the low-level gameplay transaction helpers. Active-run field init and flatten helpers live in `shared/stores/run-state-init.ts` (`pickActiveRunView` is the shared canonical view for committed session reads and the imperative run read). Fresh-run snapshots live in `shared/run-flow/run-start.ts` (consumed by run-setup and the aggregate). Feature code imports narrow ports, commands, reads, writes, and lifecycle directly from their owning modules.

## Import boundaries

Enforced in `eslint.config.js` (composition in `eslint/fragments.js` + `eslint/boundaries.js`) and double-checked by `npm run lint:boundaries` (dependency-cruiser). Phase bans and flat-config stacking order live in those files; `tests/architecture/eslint-boundary-stacking.test.ts` asserts stacked `no-restricted-imports` fragments. Summary:

- `src/lib/**` must not import `@/features/**`
- Feature code outside `shared/stores/` imports capability ports, commands, reads, writes, and lifecycle modules directly (not compatibility stores or `run-transitions`)
- Screens must not import `run-loop/battle` or `run-loop/navigation` orchestration
- `run-setup` ↛ `run-loop` and `run-loop` ↛ `run-setup` (shared helpers in `shared/run-flow/`)
- `meta` ↛ `run-loop` / `run-setup`

## Boot and loading

One loading experience at cold start, then instant navigation — no per-route "Loading …" fallbacks.

| Layer          | Where                                                  | Policy                                        |
| -------------- | ------------------------------------------------------ | --------------------------------------------- |
| Images         | `allGameArt` in `assets.ts` (eager `import.meta.glob`) | Decoded before menu via `useInitialLoadReady` |
| Fonts          | `use-initial-load-ready.ts`                            | With images at startup                        |
| Screen JS      | `src/app/screen-routes/`                               | Static imports — **no** `React.lazy()`        |
| Runtime extras | `use-app-preload-effects.ts`                           | Battle/rewards/shop warm-up only              |
| SFX            | `use-app-audio-effects.ts`                             | Critical sounds eager; rest on idle           |

**Do not add:** `React.lazy()` on route screens; lazy game art; per-screen spinners for assets in `allGameArt`.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only (`shouldSkipStartupLoadingGate()`).

## Testing tiers

Path-specific commands: [CONTRIBUTING.md § What to run](../CONTRIBUTING.md#what-to-run-when-you-change). CI parity: [CONTRIBUTING.md § CI parity](../CONTRIBUTING.md#ci-parity).

| Tier         | Command                         |
| ------------ | ------------------------------- |
| Unit         | `npm test`                      |
| Local fast   | `npm run check:push`            |
| CI critical  | `npm run test:e2e:prepush:full` |
| Broader/full | `npm run test:e2e:full`         |
