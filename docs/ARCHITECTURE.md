# Alchemy architecture

Canonical reference for run state, store layout, and boot policy. Coding rules: [AGENTS.md](../AGENTS.md). Gameplay / battle rules: [REFERENCE.md § Battle](./REFERENCE.md#battle-implementation-rules). How-to: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [PROMPTS.md](../PROMPTS.md).

`src/lib/` stays React-free: `battle/`, `game-data/`, `content-systems/`, `homestead/`, `validation/`, `game-constants.ts`, audio modules.

## Directory layout (`src/features/alchemy/`)

| Path | Role |
|------|------|
| `shared/` | `stores/`, `storage/`, `ui/`, `config/`, `utils/`, `types.ts`, `screens/index.ts` (barrel) |
| `meta/` | Menu, collection, homestead, talents |
| `run-setup/` | Character, difficulty, draft screens |
| `run-loop/` | Battle glue, navigation, shop, in-run screens |
| `shell/` | Controller hooks |

Import using on-disk paths (e.g. `@/features/alchemy/shared/stores/run-session-facade`). `src/lib/` stays React-free.

## Run state

A single **run** is owned by **`useRunDomainStore`** (`shared/stores/run-domain-store.ts`) with four slices: `progress`, `session`, `navigation`, and `battle`.

| Concern | Owner | Notes |
|---------|--------|--------|
| Deck, gold, HP, acts, trinkets, talents | `progress` | Persisted with meta save |
| Rewards, shops, labyrinth, mystery | `session` | Transient per run |
| Current `Screen` | `navigation` | `useActiveRunScreen()` |
| Combat snapshot + display overrides | `battle` | Synced during battle |
| Battle VFX | `battle-presentation-store` | Not persisted |
| Lifecycle | `run-transitions.ts` | Restore, snapshot, teardown, battle sync |

### Persistence API

| API | Role |
|-----|------|
| `createActiveRunSnapshot(source)` | Serialize explicit fields → `ActiveRunData` (lib) |
| `snapshotRun(screen?)` | Read domain store → `ActiveRunData` |
| `restoreRun(…)` | Apply snapshot on boot/resume |
| `parseActiveRun(raw)` | Validate JSON before hydrate |

### Session facade (`run-session-facade.ts`)

- **Reads:** `readActiveRunStore()`, `readRunSessionStore()`, `readBattleStore()`
- **Writes:** `setRewardState`, `setShopState`, labyrinth/mystery setters, etc.
- **Hooks:** `useRunSession*Slice()`, `useActiveRunScreen()`, `useRunScreenData(screen)`
- **Lifecycle:** re-exports `teardownRun`, `syncRunToBattleStart`, `syncBattleToRun` from `run-transitions.ts`

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

| Concern | Start here |
|---------|------------|
| Run lifecycle | `shell/use-alchemy-run-controller.ts`, `run-transitions.ts` |
| Navigation / rewards | `shell/use-run-navigation.ts`, `run-loop/navigation/*` |
| Battle | `shell/use-battle-controller.ts` → `lib/battle/*` |
| Session reads/writes | `shared/stores/run-session-facade.ts` |
| Screen routing | `shell/use-screen-navigation.ts`, `useActiveRunScreen()` |

## Meta compendium (`app-store`)

`discoveredCardIds`, `encounteredEnemyIds`, and `discoveredTrinketIds` live in `app-store` (persisted with save data). Run controllers read/write via `useAppStore.getState()` — not props from `App.tsx`.

## Types

Run domain types live in `run-domain-types.ts` / `run-domain-store.ts` (stores layer only). Feature code imports `useRunAdapter`, `useTalentAdapter`, reads, writes, and lifecycle via `run-session-facade`.

## Import boundaries

Enforced in `eslint.config.js`. **Full ESLint layer table:** [AGENTS.md § Import boundaries](../AGENTS.md#import-boundaries-eslint). Summary:

- `src/lib/**` must not import `@/features/**`
- Feature code outside `shared/stores/` uses `run-session-facade`, not `run-domain-store` directly
- Screens must not import `run-loop/battle` or `run-loop/navigation` orchestration

## Boot and loading

One loading experience at cold start, then instant navigation — no per-route "Loading …" fallbacks.

| Layer | Where | Policy |
|-------|--------|--------|
| Images | `allGameArt` in `assets.ts` (eager `import.meta.glob`) | Decoded before menu via `useInitialLoadReady` |
| Fonts | `use-initial-load-ready.ts` | With images at startup |
| Screen JS | `src/app/screen-routes/` | Static imports — **no** `React.lazy()` |
| Runtime extras | `use-app-preload-effects.ts` | Battle/rewards/shop warm-up only |
| SFX | `use-app-audio-effects.ts` | Critical sounds eager; rest on idle |

**Do not add:** `React.lazy()` on route screens; lazy game art; per-screen spinners for assets in `allGameArt`.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only (`shouldSkipStartupLoadingGate()`).

## Testing tiers

Path-specific commands: [CONTRIBUTING.md § What to run](../CONTRIBUTING.md#what-to-run-when-you-change). CI parity: [CONTRIBUTING.md § CI parity](../CONTRIBUTING.md#ci-parity).

| Tier | Command |
|------|---------|
| Unit | `npm test` |
| Pre-push | `npm run test:e2e:prepush` |
| Full gate | `npm run test:e2e:main-gate` |
