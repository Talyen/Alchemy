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

Gameplay mutation callers enter the session through `dispatchRunSessionCommand()` from `run-session-command.ts`. The command boundary opens one Immer draft of the authoritative aggregate, directly replaces the aggregate root with one incremented revision on success, and discards the draft on failure. React selectors and autosave subscribe to that same root; there is no committed compatibility snapshot or second publish seam to drift from it. Settings and presentation-only state remain separate. Commands are synchronous and must not span an `await`; audio, navigation timers, presentation updates, and other non-rollbackable work use the command's `afterCommit` option or run after the command returns. Draft mutators receive the draft explicitly and compose inside one command; a command body must not call another command. Transactional checks that guard a write, such as shop gold, refresh counts, and purchased slots, read from that same draft rather than a committed read port. Persistence adapters may subscribe to the aggregate commit signal directly; gameplay callers must not.

Battle reads are data-only: `run-session-read-port.ts` does not expose aggregate mutators. Battle writes use focused draft-first mutators from `run-session-write-port.ts`; event-time calls open one command and existing command recipes pass their draft explicitly. An asynchronous battle transition that changes logical state must persist its continuation in `activeCombat.pendingBattleTransition` in the same commit as its intermediate state. Presentation delays and display overrides may continue after that commit, but a booted battle must never depend on an in-memory promise or timer to become playable.

### Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Command recipes obtain their generator explicitly through `createDraftRunRandomSource(draft, stream)` so counter advancement commits or rolls back with the resulting gameplay state. `createRunRandomSource(stream)` is reserved for the callback stored on `BattleState` and rebound during battle hydration. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw. Battle randomness remains owned by immutable `BattleState.rng`.

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

| API                                    | Role                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `encodeRunResumeSnapshot(source)`      | Sole `RunSession` → `ActiveRunData` assembler (content-system nulling, `activeCombat`, resume semantics) |
| `decodeRunResumeSnapshot(data)`        | Translate `ActiveRunData` → aggregate session fields                                                     |
| `snapshotRun(screen?)`                 | Read aggregate run state through the codec                                                               |
| `restoreRun(…)`                        | Apply the decoded snapshot on boot/resume (incl. trinket-manifest repair)                                |
| `parseActiveRun(raw)`                  | Validate JSON before hydrate                                                                             |
| `PersistedBattleStateSchema`           | Single BattleState wire parse + default merge                                                            |
| `activeCombat.pendingBattleTransition` | Resume an interrupted enemy-turn continuation                                                            |
| Domain persistence codecs              | Own defaults, encode, hydrate, and subscriptions                                                         |
| Persistence coordinator                | Compose domain fields into the versioned envelope                                                        |
| `platform-save-backend.ts`             | Browser/Desktop transport, backup/cloud candidate order, and recoverable write/clear ordering            |

`shared/storage/io.ts` owns save parsing, validation, future-version protection, and write serialization. It delegates raw persistence to one `SaveBackend` configured during bootstrap. `initializeSteam()` returns an explicit `cloudSyncEnabled` capability; it does not mutate shared platform state. The platform backend always considers Steam Cloud as the final desktop read fallback, writes the local backup-ring file before a non-blocking cloud mirror, and deletes cloud before local data so a failed cloud deletion leaves recoverable local candidates intact.

### Session capability ports

- **Reads (imperative):** `run-session-read-port.ts` exposes data-only `readActiveRun()`, `readRunProfile()`, `readRunSession()`, and `readBattle()` — for handlers, lifecycle, and non-React code
- **Reads (React, screen-scoped):** screen-specific hooks in `use-run-screen-data.ts` (for example `useShopScreenData`, `useRewardsScreenData`, and `useGameOverScreenData`) — each hook selects directly from the aggregate and returns only its route's exact display contract
- **Reads (React, orchestration):** `useRunSessionNavigationSlice(screen)`, `useRunSessionBattleContext(screen)` from `run-session-model.ts` — both select directly from the aggregate; do not mirror screen display fields
- **Reads (React, meta/setup):** focused selectors and narrow orchestration ports from `run-session-react-ports.ts` (`useHomesteadProgressSlice`, `useTalentProgressSlice`, `useDraftDeckSlice`, `useRunOrchestrationPort`, `useBattleRunPort`, …); these select from the aggregate and expose only the fields needed by one owner
- **Writes:** `dispatchRunSessionCommand` and the draft mutators in `run-session-write-port.ts` (`setRewardState`, `setShopState`, labyrinth/mystery setters, run progression, profile awards, …). Every port mutation takes `GameplayDraft` as its first argument; there is no self-dispatching overload. Event-time handlers wrap mutators in one command (or use the explicit `createRunSessionCommand` adapter), while command bodies pass their existing draft directly. Mutators that accept a functional update (`value | (previous) => next`) use an `update*` prefix (`updateRunDeck`, `updateCurrentAct`) to distinguish them from plain-value `set*` setters (`setScreen`, `setCharacter`).
- **Battle writes:** `setBattleState`, `beginBattleTransition`, `commitBattleTransition`, and related commands from `run-session-write-port.ts`; `readBattle()` is intentionally data-only
- **Hooks:** `useActiveRunScreen()`, screen-specific display hooks, and the navigation/battle context slices above
- **Lifecycle:** `run-session-lifecycle-port.ts` owns the public lifecycle seam over `run-transitions.ts`
- **Composed views:** there is no all-domain projection module. `run-session-read-port.ts` exposes action-free lifetime reads, `run-session-react-ports.ts` owns narrow React ports, and `run-session-write-port.ts` owns mutation capabilities. `run-session-command.ts` coordinates atomic aggregate commits (Immer draft + one published revision); it does not publish a second read store or maintain nested transaction state.

**Do not add** a broad all-screens display bag or a second flattening read model. Each route owns its exact screen-specific hook; the shared `RunScreenDataByScreen` map in `run-screen-data.ts` keeps those contracts explicit. Controllers own **commands**; `use-alchemy-run-controller.ts` assembles the phase-scoped command tree directly at the shell composition root, while screen routes own **display data** via their specific hooks. App chrome / autosave / particles read via capability hooks (`useActiveRunCharacterId`, `useTalentProgressSlice`, `useRunSessionBattleContext`, …), not controller display re-exports. Imperative handlers read lifetime-specific ports (`readActiveRun`, `readRunProfile`, `readRunSession`, `readBattle`) at call time; they do not receive a React controller data bus. Battle refs and handlers travel through `routeCommands.battle`; battle display state and presentation transfers are read locally by the battle route. Battle and run-flow controllers take narrow `BattleRunPort` / `BattleTalentPort` and `RunFlowRunPort` / `RunFlowTalentPort` inputs. Run-flow handlers call shell side effects through `RunFlowShellActions` (assembled once in `use-run-flow-engine.ts` from battle/shop/labyrinth/wildwood/mystery callbacks — not parallel NavOps bags), and the composition root passes each concern only the direct callbacks it needs; there is no mutable sibling-handler bag or hidden continuation dispatcher. Pure destination/reward routers take a `Pick` of those shell actions (plus focused callback extras only where needed): `DestinationRouteDeps` and `RewardRouteDeps`. Active-run core fields shared by committed session reads come from `pickActiveRunView` in `run-state-init.ts`.

Boot: [`use-alchemy-bootstrap.ts`](../src/app/use-alchemy-bootstrap.ts) applies persistence owners and calls the canonical `restoreRun` transition before publishing bootstrap readiness (guarded by `readRunInitialized`), so [`App.tsx`](../src/App.tsx) cannot render `AppInner` against an unhydrated run. `bootstrap-save-state.ts` initializes Steam, configures the save backend from the returned capabilities, and only then loads candidates. `restoreRun` is the only runtime hydration path. `run-resume-codec.ts` is the single feature-owned translation boundary for save/resume state; `restore-active-run-session.ts` only applies its decoded session fields through the aggregate session action group, so autosave and boot hydration cannot grow separate field mappings. The shell controller wires domain controllers into a phase-scoped `routeCommands` tree; it is not a display-data bus.

### Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

### Run setup ownership

`run-setup/run/content-system-navigation.ts` owns content-system selection, character/difficulty routing, and creation of a fresh campaign, labyrinth, or Wildwood run. Its run-start recipes use the draft-only helper in `run-start-command.ts`; event handlers own the surrounding command and post-commit effects. Wildwood setup ends once its persisted draft is created. From the first draft pick onward, `shell/use-wildwood-gauntlet-flow.ts` is the sole owner of Wildwood draft completion, boss progression, recovery, rewards, and resume routing.

Destination offer construction is pure in `shared/run-flow/destination-flow.ts`. Campaign start and run-loop progression supply explicit offer history, boss ID, and command-bound RNG; destination generation is not exposed through the content-system navigation API.

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
- **Shell preload / autosave:** App warms the centralized `allGameArt` manifest before reveal; autosave and chrome read needed fields through capability modules, not controller state re-exports. Critical UI sounds load eagerly. Battle initialization then prioritizes the visible hand and current enemy sounds; the remaining manifest decodes one item at a time during input-idle work so background audio warming cannot compete with interaction frames.

## Controller entry points

| Concern                 | Start here                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run lifecycle           | `shell/use-alchemy-run-controller.ts`, `run-session-lifecycle-port.ts`                                                                               |
| Route command maps      | `shell/use-alchemy-run-controller.ts` composition root                                                                                               |
| Navigation / rewards    | `shell/use-run-flow-engine.ts` (destination/content/mystery hooks + inlined flow factories) + `run-loop/navigation/*` / `run-loop/run/*`             |
| Content-system entry    | `run-setup/run/content-system-navigation.ts` → `run-start-command.ts`; Wildwood post-entry flow stays in `shell/use-wildwood-gauntlet-flow.ts`       |
| Run-flow shell actions  | `run-loop/run/run-flow-shell-actions.ts` (assembled in `shell/use-run-flow-engine.ts`); routers use `DestinationRouteDeps` / `RewardRouteDeps` picks |
| Run-flow / battle ports | `shared/stores/run-port-types.ts` (`RunFlowRunPort`, `BattleRunPort`, …)                                                                             |
| Battle                  | `shell/use-battle-controller.ts` → `lib/battle/*`                                                                                                    |
| Shops                   | `shell/use-shop-controller.ts` → `run-loop/shop/create-shop-actions.ts` → domain command modules                                                     |
| Session reads/writes    | `shared/stores/run-session-read-port.ts`, `run-session-write-port.ts`, `run-session-command.ts`                                                      |
| Screen routing          | `shell/use-screen-transitions.ts`, `useActiveRunScreen()`                                                                                            |

## Shop commands

`useShopController` memoizes one domain-shaped command surface: `initialize(kind)` plus `merchant`, `alchemist`, `trinket`, and `equipment` command groups. `create-shop-actions.ts` is composition only; each shop's initialization, purchases, services, refreshes, and live price selectors belong to its matching `*-shop-commands.ts` module. Route assembly consumes the nested groups directly, while destination and Labyrinth routing receive only the shared `initialize(kind)` capability.

Shared recipes in `run-loop/shop/shop-transactions.ts` operate on the active command draft and return an explicit `ShopTransactionResult`; they do not dispatch commands or play audio. Domain commands calculate guarded prices from that same draft, own the single `dispatchRunSessionCommand()` boundary, and trigger spend feedback only after the command returns. Equipment acquisition remains in `equipment-shop-commands.ts` and must use `dispatchGearMutationWithRunHealthSync()` so permanent Gear and active-run health commit atomically.

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

Aggregate fields and action wiring live in `gameplay-state-store.ts`; action-free feature reads live in `run-session-read-port.ts` and draft mutators live in `run-session-write-port.ts`. React orchestration ports live in `run-session-react-ports.ts` and `run-port-types.ts`. Exact screen display contracts live in `run-screen-data.ts` (`RunScreenDataByScreen`); screen-specific React selectors live in `use-run-screen-data.ts` — do not recreate a broad all-screen bag or parallel flatten twin. `run-session-command.ts` is the atomic commit coordinator over the nested aggregate root (`dispatchRunSessionCommand`). Gameplay mutations use that command boundary; persistence codecs receive a draft from the coordinator for hydration, and feature code must not reach into low-level store update helpers. Active-run field init and flatten helpers live in `shared/stores/run-state-init.ts` (`pickActiveRunView` is the shared canonical view for committed session reads and the imperative run read). Fresh-run snapshots live in `shared/run-flow/run-start.ts` (consumed by run-setup and the aggregate). Feature code imports narrow ports, commands, reads, writes, and lifecycle directly from their owning modules.

## Import boundaries

Enforced in `eslint.config.js` (composition in `eslint/fragments.js` + `eslint/boundaries.js`) and double-checked by `npm run lint:boundaries` (dependency-cruiser). Phase bans and flat-config stacking order live in those files; `tests/architecture/eslint-boundary-stacking.test.ts` asserts stacked `no-restricted-imports` fragments. Summary:

- `src/lib/**` must not import `@/features/**`
- `gameplay-state-store.ts` is internal to `shared/stores/`; other layers use capability hooks, reads, writes, commands, and lifecycle ports
- Feature code outside `shared/stores/` imports capability ports, commands, reads, writes, and lifecycle modules directly (not compatibility stores or `run-transitions`)
- Screens must not import `run-loop/battle` or `run-loop/navigation` orchestration
- `run-setup` ↛ `run-loop` and `run-loop` ↛ `run-setup` (shared helpers in `shared/run-flow/`)
- `meta` ↛ `run-loop` / `run-setup`

## Boot and loading

One loading experience at cold start, then instant navigation — no per-route "Loading …" fallbacks.

| Layer     | Where                                                  | Policy                                   |
| --------- | ------------------------------------------------------ | ---------------------------------------- |
| Images    | `allGameArt` in `assets.ts` (eager `import.meta.glob`) | Decoded in bounded batches before reveal |
| Fonts     | `use-app-effects.ts`                                   | Ready with images before reveal          |
| Screen JS | `src/app/screen-routes/`                               | Static imports — **no** `React.lazy()`   |
| SFX       | `use-app-effects.ts`                                   | Critical sounds eager; rest on idle      |

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
