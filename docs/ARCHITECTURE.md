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

Import using on-disk paths (e.g. `@/features/alchemy/shared/stores/run-session-facade`). `src/lib/` stays React-free.

`shared/run-flow/` is the neutral seam for destination sampling and campaign-start helpers so `run-setup` and `run-loop` do not import each other (ESLint-enforced).

## Run state

Run state is split across four **lifetime-matched stores** in `shared/stores/`. Each store owns its fields at the root; there are no nested subtrees.

| Store                     | Concern                                                                                 | Lifetime                                            |
| ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `run-domain-store`        | `activeRun` (deck, gold, HP, acts, trinkets, RNG, tallies), `navigation`, `initialized` | Reset by run teardown; `initialized` is boot-scoped |
| `run-profile-store`       | Homestead, talent XP / unlocks, derived `effects`                                       | Meta lifetime; survives teardown                    |
| `run-transient-store`     | Rewards, shops, labyrinth, mystery, pending selections, run-flow claims                 | Transient per run                                   |
| `run-battle-domain-store` | Combat snapshot, battle-start state, display overrides                                  | Transient per battle                                |

Cross-store writes go through ports in `shared/stores/ports/` (`run-profile-write-port`, `run-session-setup-port`, reward / shop / labyrinth / mystery ports); multi-store lifecycle orchestration lives in `run-transitions.ts`. Facade adapters (`useRunAdapter`, `useTalentAdapter`, `useHomesteadProgressSlice`, `readActiveRunStore`) preserve focused feature-facing views.

### Run randomness

Run-level randomness is persisted in `activeRun.rng` as one seed plus counters for the named `rewards`, `destinations`, `events`, `shops`, and `world` streams. Feature orchestration obtains state-backed generators through `createRunRandomSource(stream)`. Advancing one stream cannot perturb another, and save/resume continues at the exact next draw. Battle randomness remains owned by immutable `BattleState.rng`.

`Math.random()` is allowed only to create a fresh run seed or for cosmetic/meta-only effects. Run outcomes must use a named run stream; battle outcomes must use `BattleState.rng`.

| Concern                             | Owner                                       | Notes                                    |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Deck, gold, HP, acts, trinkets      | `run-domain-store.activeRun`                | Persisted inside `activeRun`             |
| Homestead + permanent talents       | `run-profile-store`                         | Persisted as top-level save fields       |
| Rewards, shops, labyrinth, mystery  | `run-transient-store`                       | Transient per run                        |
| Current `Screen`                    | `run-domain-store.navigation`               | `useActiveRunScreen()`                   |
| Combat snapshot + display overrides | `run-battle-domain-store`                   | Synced during battle                     |
| Battle VFX                          | `battle-presentation-store`                 | Not persisted                            |
| Lifecycle                           | `run-session-facade` → `run-transitions.ts` | Restore, snapshot, teardown, battle sync |

### Persistence API

| API                               | Role                                              |
| --------------------------------- | ------------------------------------------------- |
| `createActiveRunSnapshot(source)` | Serialize explicit fields → `ActiveRunData` (lib) |
| `snapshotRun(screen?)`            | Read run-lifetime stores → `ActiveRunData`        |
| `restoreRun(…)`                   | Apply snapshot on boot/resume                     |
| `parseActiveRun(raw)`             | Validate JSON before hydrate                      |
| Domain persistence codecs         | Own defaults, encode, hydrate, and subscriptions  |
| Persistence coordinator           | Compose domain fields into the versioned envelope |

### Session facade (`run-session-facade.ts`)

- **Reads:** `readActiveRunStore()`, `readRunSessionStore()`, `readBattleStore()`
- **Writes:** `setRewardState`, `setShopState`, labyrinth/mystery setters, etc.
- **Hooks:** `useRunSession*Slice()`, `useActiveRunScreen()`, `useRunScreenData(screen)`
- **Lifecycle:** re-exports `restoreRun`, `snapshotRun`, `teardownRun`, `syncRunToBattleStart`, `syncBattleToRun`, `finalizeRunEndSession` and friends from `run-transitions.ts`
- **Ports:** re-exports the reward / shop / labyrinth / mystery setters plus `awardMaterialsDuringRun`, `finalizeRunXP`, and run-setup writers

Boot: [`use-alchemy-run-controller.ts`](../src/features/alchemy/shell/use-alchemy-run-controller.ts) calls `restoreRun` in `useLayoutEffect`.

### Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

## Battle path (simplified)

```
Screen route → battleBindings (props) → BattleScreen
           → useAlchemyRunController → useBattleController → run-loop/battle/* → run-session-facade → lib/battle
```

`useAlchemyRunController` exposes `battleBindings` (refs, transfers, `battleScreenData`). `App.tsx` passes them through `RenderAlchemyScreen` → `run-loop-routes` — no React context.

Presentation VFX uses `battle-presentation-store` only. Global card hover/shimmer uses `ui-store`.

### Data flow

- **Card play:** UI → `useBattleController.playCard()` → `playBattleCardResolved()` → `applyCardEffects()` → new `BattleState` → store.
- **Enemy turn:** `endPlayerTurn()` → enemy resolution → status ticks → new `BattleState`.
- **Screen transition:** `navigateTo` → `navigation.screen` → `renderAlchemyScreenRoute()`.

## Controller entry points

| Concern              | Start here                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| Run lifecycle        | `shell/use-alchemy-run-controller.ts`, `run-session-facade` lifecycle APIs |
| Navigation / rewards | `shell/use-run-navigation.ts`, `run-loop/navigation/*`                     |
| Battle               | `shell/use-battle-controller.ts` → `lib/battle/*`                          |
| Session reads/writes | `shared/stores/run-session-facade.ts`                                      |
| Screen routing       | `shell/use-screen-transitions.ts`, `useActiveRunScreen()`                  |

## Settings and meta profile

- `settings-store` owns display, audio, and gameplay preferences. It does not contain gameplay progression.
- `profile-store` owns compendium discoveries, completed difficulties, finished-run characters, and transient collection browsing state.
- `run-profile-store` owns homestead and talent progression. Run reward finalization writes through `run-profile-write-port` / facade lifecycle helpers — do not merge this into `profile-store`.
- `gear-store` owns the permanent Gear subdomain and its invariants.

Each persistence owner exposes a codec beside its store. The codec owns that domain's save-field contract, defaults, encoding, hydration, and subscription. `shared/storage/persistence-coordinator.ts` only composes those codecs; it contains no field-by-field store mapping. Feature code uses the owning store or its focused read/action port.

## Permanent Gear (`gear-store`)

Owned Gear instances and per-character loadouts live in `shared/stores/gear-store.ts`. Definitions and pure equip/salvage/effect rules live under `src/lib/gear/`. Gear is permanent meta progression and is not copied into active-run data; battle creation snapshots the selected character's aggregate Gear effects into the immutable battle talent manifest.

Run-loop / run-setup / shell read gear through `shared/stores/gear-read-port.ts` (`readGearManifestForCharacter`, `readHasAnyOwnedGear`, …) instead of reaching into the full store API. Mutations stay on `gear-store` / the armory controller.

Each Gear instance may be equipped on at most one character at a time (one slot per loadout). Equipping moves the instance off any other character or slot. Armory editing is disabled while a battle is active. Autosave subscribes to the Gear store and uses the transient Return to Run screen when meta screens are opened during a run. See [ARMORY.md](./ARMORY.md) for the data model, state flow, board-packing rules, drag FSM, battle integration, and tests map.

## Types

Run domain types live in `run-domain-types.ts` / `run-domain-store.ts` (stores layer only); permanent-profile fields are typed in `run-state-init.ts`. Active-run field init and flatten helpers live in `shared/stores/run-state-init.ts`. Fresh-run snapshots live in `shared/run-flow/run-start.ts` (consumed by run-setup and stores). Feature code imports `useRunAdapter`, `useTalentAdapter`, reads, writes, and lifecycle via `run-session-facade`.

## Import boundaries

Enforced in `eslint.config.js` (composition in `eslint/fragments.js` + `eslint/boundaries.js`) and double-checked by `npm run lint:boundaries` (dependency-cruiser). Phase bans and flat-config stacking order live in those files; `tests/architecture/eslint-boundary-stacking.test.ts` asserts stacked `no-restricted-imports` fragments. Summary:

- `src/lib/**` must not import `@/features/**`
- Feature code outside `shared/stores/` uses `run-session-facade` only (not run stores, ports, or `run-transitions`)
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
