# Alchemy architecture

Canonical reference for run state, store layout, and import boundaries. Gameplay rules and commands: [AGENTS.md](../AGENTS.md). Implementation checklists: [WORKFLOWS.md](./WORKFLOWS.md).

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

## Meta compendium (`app-store`)

`discoveredCardIds`, `encounteredEnemyIds`, and `discoveredTrinketIds` live in `app-store` (persisted with save data). Run controllers read/write via `useAppStore.getState()` — not props from `App.tsx`.

## Types

Run domain types live in `run-domain-types.ts` / `run-domain-store.ts` (stores layer only). Feature code imports `useRunAdapter`, `useTalentAdapter`, reads, writes, and lifecycle via `run-session-facade`.

## Import boundaries

Enforced in `eslint.config.js` (not duplicated in Vitest). Summary:

- `src/lib/**` must not import `@/features/**`
- Feature code outside `shared/stores/` uses `run-session-facade`, not `run-domain-store` directly
- Screens must not import `run-loop/battle` or `run-loop/navigation` orchestration

## Testing tiers

| Tier | Command |
|------|---------|
| Unit | `npm test` |
| Pre-push | `npm run test:e2e:prepush` |
| Full gate | `npm run test:e2e:main-gate` |
