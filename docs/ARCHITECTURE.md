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

Gameplay state has one authoritative nested Zustand aggregate in `shared/stores/gameplay-state-store.ts`. Its `run`, `session`, `battle`, `runProfile`, `profile`, and `gear` objects are the domain-shaped state; action groups sit beside those objects so commands cannot accidentally read or write another domain's fields. Lifetime-matched compatibility slices project those nested domains for event-time and persistence bridges, but hold no independent state or revisions.

| Compatibility slice       | Concern                                                                                 | Lifetime                                            |
| ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `run-domain-store`        | `activeRun` (deck, gold, HP, acts, trinkets, RNG, tallies), `navigation`, `initialized` | Reset by run teardown; `initialized` is boot-scoped |
| `run-profile-store`       | Homestead, talent XP / unlocks, derived `effects`                                       | Meta lifetime; survives teardown                    |
| `run-transient-store`     | Rewards, shops, labyrinth, mystery, pending selections, run-flow claims                 | Transient per run                                   |
| `run-battle-domain-store` | Combat snapshot, battle-start state, display overrides                                  | Transient per battle                                |

Cross-concern writes go through ports in `shared/stores/ports/` (`run-profile-write-port`, `run-session-setup-port`, reward / shop / labyrinth / mystery ports); multi-concern lifecycle orchestration is exposed through `run-session-lifecycle-port.ts`. Canonical imperative queries live in `run-session-queries.ts` and project the aggregate directly for event-time handlers and persistence bridges. React orchestration uses narrow ports from `run-session-react-ports.ts` such as `useRunFlowRunPort`, `useBattleRunPort`, and `useTalentCommandPort`; screens use exact screen-data hooks. Profile reads and imperative active-run/session/battle reads are separate capability ports, so no caller receives a cross-lifetime flattened view.

Gameplay mutation callers enter the session through `dispatchRunSessionCommand()` from `run-session-command.ts`. The command boundary opens an Immer draft of the authoritative aggregate, publishes one root revision on success, and discards the draft on failure. `useRunSessionCommitStore` is now a compatibility projection over that root (it stores no shadow copy), so React selectors and autosave cannot observe mixed revisions. Settings and presentation-only state remain separate. Commands are synchronous and must not span an `await`; audio, navigation timers, presentation updates, and other non-rollbackable work use the command's `afterCommit` option or run after the command returns. Nested commands defer their effects until the outer commit, and discard them if any nested work fails. Projection and persistence adapters may subscribe to the aggregate commit signal directly; gameplay callers must not.

### Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Feature orchestration obtains state-backed generators through `createRunRandomSource(stream)`. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw. Battle randomness remains owned by immutable `BattleState.rng`.

`Math.random()` is allowed only to create a fresh run seed or for cosmetic/meta-only effects. Run outcomes must use a named run stream; battle outcomes must use `BattleState.rng`.

| Concern                             | Owner                                                  | Notes                                    |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Deck, gold, HP, acts, trinkets      | `run-domain-store.activeRun`                           | Persisted inside `activeRun`             |
| Homestead + permanent talents       | `run-profile-store`                                    | Persisted as top-level save fields       |
| Rewards, shops, labyrinth, mystery  | `run-transient-store`                                  | Transient per run                        |
| Current `Screen`                    | `run-domain-store.navigation`                          | `useActiveRunScreen()`                   |
| Combat snapshot + display overrides | `run-battle-domain-store`                              | Synced during battle                     |
| Battle VFX                          | `battle-presentation-store`                            | Not persisted                            |
| Lifecycle                           | `run-session-lifecycle-port.ts` → `run-transitions.ts` | Restore, snapshot, teardown, battle sync |

### Persistence API

| API                               | Role                                                     |
| --------------------------------- | -------------------------------------------------------- |
| `createActiveRunSnapshot(source)` | Serialize explicit fields → `ActiveRunData` (lib)        |
| `encodeRunResumeSnapshot(source)` | Translate the committed run projection → `ActiveRunData` |
| `decodeRunResumeSnapshot(data)`   | Translate `ActiveRunData` → transient resume projection  |
| `snapshotRun(screen?)`            | Read the committed run projection through the codec      |
| `restoreRun(…)`                   | Apply the decoded snapshot on boot/resume                |
| `parseActiveRun(raw)`             | Validate JSON before hydrate                             |
| Domain persistence codecs         | Own defaults, encode, hydrate, and subscriptions         |
| Persistence coordinator           | Compose domain fields into the versioned envelope        |

### Session capability ports

- **Reads (imperative):** `run-session-read-port.ts` exposes `readActiveRun()`, `readRunProfile()`, `readRunSession()`, and `readBattle()` — for handlers, lifecycle, and non-React code
- **Reads (React, screen-scoped):** screen-specific hooks in `use-run-screen-data.ts` (for example `useShopScreenData`, `useRewardsScreenData`, and `useGameOverScreenData`) — each hook selects from the committed `useRunSessionCommitStore` projection and returns only its route's exact display contract
- **Reads (React, orchestration):** `useRunSessionNavigationSlice(screen)`, `useRunSessionBattleContext(screen)` from `run-session-model.ts` — both read the same committed projection; do not mirror screen display fields
- **Reads (React, meta/setup):** focused selectors and narrow orchestration ports from `run-session-react-ports.ts` (`useHomesteadProgressSlice`, `useTalentProgressSlice`, `useDraftDeckSlice`, `useRunFlowRunPort`, `useBattleRunPort`, `useTalentCommandPort`, …); these select from the committed projection and expose only the fields needed by one owner
- **Writes:** `dispatchRunSessionCommand`, `setRewardState`, `setShopState`, labyrinth/mystery setters, etc.
- **Hooks:** `useActiveRunScreen()`, screen-specific display hooks, and the navigation/battle context slices above
- **Lifecycle:** `run-session-lifecycle-port.ts` owns the public lifecycle seam over `run-transitions.ts`
- **Ports:** focused write modules own reward / shop / labyrinth / mystery setters plus profile and run-setup writers
- **Composed views:** `run-session-queries.ts` owns lifetime-matched aggregate projections used by event-time handlers and persistence; `run-session-react-ports.ts` owns narrow React ports. There is no compatibility facade or cross-lifetime flattened read model. `run-domain-store` owns only the nested run domain projection + lifetime reset

**Do not add** a broad all-screens display bag or a second flattening read model. Each route owns its exact screen-specific hook; the shared `RunScreenDataByScreen` map in `run-screen-data.ts` keeps those contracts explicit. Controllers own **commands** (assembled by `shell/create-route-commands.ts`); screen routes own **display data** via their specific hooks. The asset preloader uses the intentionally small `useScreenAssetPreloadData` projection because it spans several possible screens. App chrome / autosave / particles read via capability hooks (`useActiveRunCharacterId`, `useTalentProgressSlice`, `useRunSessionBattleContext`, …), not controller display re-exports. Imperative handlers read lifetime-specific ports (`readActiveRun`, `readRunProfile`, `readRunSession`, `readBattle`) at call time; they do not receive a React controller data bus. Battle uses controller `battleBindings` props (intentional exception) and takes narrow `BattleRunPort` / `BattleTalentPort` inputs. Run-flow handlers take narrow `RunFlowRunPort` / `RunFlowTalentPort`, dispatch intents to the shell, and use typed `RunFlowContinuation` values for cross-concern transitions; the shell executes intents via `createRunFlowIntentExecutor` (navigate, shops, battle starts, content hooks). Active-run core fields shared by committed session reads come from `pickActiveRunSessionCoreFields` in `run-state-init.ts`.

Boot: [`use-alchemy-run-controller.ts`](../src/features/alchemy/shell/use-alchemy-run-controller.ts) calls the canonical `restoreRun` transition in `useLayoutEffect`. `restoreRun` is the only runtime hydration path. `run-resume-codec.ts` is the single feature-owned translation boundary for save/resume state; `restore-active-run-session.ts` only applies its decoded projection to the transient store, so autosave and boot hydration cannot grow separate field mappings. The mega-controller is a thin composer: domain controllers + `createAlchemyRouteCommands` + `battleBindings`.

### Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

## Battle path (simplified)

```
Screen route → battleBindings (props) → BattleScreen
           → useAlchemyRunController → useBattleController (BattleRunPort / BattleTalentPort)
           → run-loop/battle/* → run-session-read-port / run-session-command → lib/battle
```

`useAlchemyRunController` exposes `battleBindings` (refs, transfers, `battleScreenData`). `App.tsx` passes them through `RenderAlchemyScreen` → `run-loop-routes` — no React context.

Presentation VFX uses `battle-presentation-store` only. Global card hover/shimmer uses `ui-store`.

### Data flow

- **Card play:** UI → `useBattleController.playCard()` → `playBattleCardResolved()` → `applyCardEffects()` → new `BattleState` → store.
- **Enemy turn:** `endPlayerTurn()` → enemy resolution → status ticks → new `BattleState`.
- **Screen transition:** `navigateTo` → `navigation.screen` → `renderAlchemyScreenRoute()`.
- **Run-loop screens:** `screen-routes` call their screen-specific read hook for display props; `routeCommands` from the shell controller provide actions — no second data bus through `useAlchemyRunController` for shop/rewards/mystery/labyrinth fields.
- **Shell preload / autosave:** App reads needed fields via capability modules (`useScreenAssetPreloadData`, battle context, and the relevant exact screen hook), not controller state re-exports.

## Controller entry points

| Concern              | Start here                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Run lifecycle        | `shell/use-alchemy-run-controller.ts`, `run-session-lifecycle-port.ts`                           |
| Route command maps   | `shell/create-route-commands.ts`                                                                 |
| Navigation / rewards | `shell/use-run-navigation.ts` (wires concern hooks) + `run-loop/navigation/*` / `run-loop/run/*` |
| Run-flow intents     | `run-loop/run/run-flow-intents.ts` + `shell/create-run-flow-intent-executor.ts`                  |
| Run-flow ports       | `run-loop/run/run-flow-ports.ts` (`RunFlowRunPort` / `RunFlowTalentPort`)                        |
| Battle               | `shell/use-battle-controller.ts` → `lib/battle/*`                                                |
| Session reads/writes | `shared/stores/run-session-read-port.ts`, `run-session-command.ts`, and focused ports            |
| Screen routing       | `shell/use-screen-transitions.ts`, `useActiveRunScreen()`                                        |

## Settings and meta profile

- `settings-store` owns display, audio, and gameplay preferences. It does not contain gameplay progression.
- `profile-store` owns compendium discoveries, completed difficulties, finished-run characters, and transient collection browsing state.
- `run-profile-store` owns homestead and talent progression. Run reward finalization writes through `run-profile-write-port` and lifecycle ports — do not merge this into `profile-store`.
- `gear-store` owns the permanent Gear subdomain and its invariants.

Each persistence owner exposes a codec beside its compatibility slice. The codec owns that domain's save-field contract, defaults, encoding, and hydration. `shared/storage/persistence-coordinator.ts` composes those codecs and subscribes to the settings codec plus the aggregate commit signal; it contains no field-by-field store mapping. Feature code uses the owning capability port.

## Permanent Gear (`gear-store`)

Owned Gear instances and per-character loadouts live in `shared/stores/gear-store.ts`. Definitions and pure equip/salvage/effect rules live under `src/lib/gear/`. Gear is permanent meta progression and is not copied into active-run data; battle creation snapshots the selected character's aggregate Gear effects into the immutable battle talent manifest.

Run-loop / run-setup / shell read gear through `shared/stores/gear-read-port.ts` (`readGearManifestForCharacter`, `readHasAnyOwnedGear`, `useGearArmorySlice`, …) instead of reaching into the full store API. Mutations enter through `dispatchGearMutationWithRunHealthSync()` so active-run health is derived from the same before/after Gear snapshot and committed with the Gear mutation. Autosave observes the single aggregate commit signal.

Each Gear instance may be equipped on at most one character at a time (one slot per loadout). Equipping moves the instance off any other character or slot. Armory editing is disabled while a battle is active. Autosave subscribes to the Gear store and uses the transient Return to Run screen when meta screens are opened during a run. See [ARMORY.md](./ARMORY.md) for the data model, state flow, board-packing rules, drag FSM, battle integration, and tests map.

## Types

Aggregate fields and action wiring live in `gameplay-state-store.ts`; lifetime compatibility slices live in `run-domain-store.ts`, `run-profile-store.ts`, `run-transient-store.ts`, `run-battle-domain-store.ts`, `profile-store.ts`, and `gear-store.ts`. The single aggregate-to-imperative projection lives in `run-session-queries.ts`; React orchestration ports live in `run-session-react-ports.ts` and `run-port-types.ts`. Exact screen display contracts live in `run-screen-data.ts` (`RunScreenDataByScreen`); screen-specific React selectors live in `use-run-screen-data.ts` — do not recreate a broad all-screen bag or parallel flatten twin. `run-session-transaction.ts` reuses the canonical query projection for its committed snapshot, backed directly by the nested aggregate root. Gameplay mutations use the command boundary in `run-session-command.ts`; only projection/persistence adapters and that command implementation should depend on the transaction implementation. Active-run field init and flatten helpers live in `shared/stores/run-state-init.ts` (`pickActiveRunSessionCoreFields` is the shared core block for committed session reads). Fresh-run snapshots live in `shared/run-flow/run-start.ts` (consumed by run-setup and stores). Feature code imports narrow ports, commands, reads, writes, and lifecycle directly from their owning modules.

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

| Tier      | Command                      |
| --------- | ---------------------------- |
| Unit      | `npm test`                   |
| Pre-push  | `npm run test:e2e:prepush`   |
| Full gate | `npm run test:e2e:main-gate` |
