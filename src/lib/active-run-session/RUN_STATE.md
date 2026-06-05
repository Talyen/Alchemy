# Run state architecture

A single **run** spans several stores plus React screen state. Use the APIs below instead of ad-hoc store wiring when saving or resuming.

## State ownership

| Concern | Owner | Notes |
|---------|--------|--------|
| Deck, gold, HP, acts, trinkets | `run-store` | Persisted with meta save |
| Rewards, shops, labyrinth map, mystery | `run-session-store` | Transient per run |
| Combat snapshot | `battle-store` | Synced during battle |
| Battle animations / display merge | `battle-presentation-store` | Not persisted |
| Current `Screen` | `use-alchemy-run-controller` (`useState`) | Not in Zustand |
| Cross-store sync | `run-session-facade` | Battle start/end, teardown |

`screen-store.ts` only exports `resetScreenStores()` — it does **not** hold the active screen.

## Lifecycle (simplified)

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Meta: menu / collection / homestead
  Meta --> RunSetup: character + difficulty + draft
  RunSetup --> RunLoop: battle or map
  RunLoop --> RunLoop: destination rewards shops mystery
  RunLoop --> Battle: combat screen
  Battle --> RunLoop: victory or flee
  RunLoop --> RunEnd: game over or run victory
  RunEnd --> Meta: teardown
  Meta --> RunLoop: resume active run
```

## Run phase (`meta` | `runLoop` | `battle` | `runEnd`)

Derived from the current **screen** and **`hasActiveBattle`** via `getRunPhase(screen, hasActiveBattle)` in `@/lib/routing`.

- Exposed on the run controller as `runPhase` and on the VR stage as `data-run-phase` (e2e: `GameStage` in `tests/pages/game-stage.ts`).
- Steam rich presence uses `getSteamRichPresenceLabel(screen, phase, characterId)`.

## Persistence API (canonical)

| API | Alias | Role |
|-----|-------|------|
| `createActiveRunSnapshot(source)` | `buildActiveRunSnapshot` | Serialize explicit fields → `ActiveRunData` |
| `buildActiveRunSnapshotFromStores(screen)` | — | Read Zustand stores → `ActiveRunData` (features facade) |
| `hydrateActiveRunSession(activeRun, …, targets)` | `restoreActiveRun` | Apply snapshot to stores on boot/resume |
| `restoreActiveRunToStores(…)` | — | `restoreActiveRun` with default store targets (features facade) |
| `getRunPhase(screen, hasActiveBattle)` | — | `meta` \| `runLoop` \| `battle` \| `runEnd` (`@/lib/routing`) |
| `parseActiveRun(raw)` | — | Validate unknown JSON before hydrate |

## Session read / write facades

| Layer | Module | Use when |
|-------|--------|----------|
| Full read model | `getRunSession(screen)` / `useRunSession(screen)` | Need run + session + battle + phase together |
| Narrow reads | `useRunSessionNavigationSlice`, `useRunSessionBattleContext`, `useRunSessionShopSlice`, `useRunSessionMysterySlice`, `useRunSessionLabyrinthSlice`, slice hooks + `useRunScreenData` | Subscribe only to fields a hook/screen needs |
| Imperative reads | `readRunSessionStore()` | One-off `getState()` in handlers (prefer over importing the store hook) |
| Writes | `run-session-actions.ts` | All `set*` on `run-session-store` from features code |
| Low-level | `getRunSessionStore()` | Only inside `run-session-actions` / `store-access` |

**Feature usage:**

- Read model: [`run-session-model.ts`](../../features/alchemy/stores/run-session-model.ts).
- Screen routes: `useRunScreenData(screen)` → [`run-screen-data.ts`](../../features/alchemy/stores/run-screen-data.ts).
- Autosave: `useActiveRunSnapshot(screen)` (three slice hooks, no full `useRunSession`).
- Restore: [`use-alchemy-run-controller.ts`](../../features/alchemy/use-alchemy-run-controller.ts) calls `restoreActiveRunToStores` on mount.
- Legacy name: `createActiveRunData` in [`active-run-data.ts`](../../features/alchemy/run/active-run-data.ts) re-exports `buildActiveRunSnapshot`.

## When changing resume data

1. Extend `ActiveRunData` + Zod in `src/lib/validation/save-schemas/active-run.ts`.
2. Update `ActiveRunSnapshotSource` in `snapshot.ts` and `createActiveRunSnapshot`.
3. Update `hydrateActiveRunSession` if new session fields need restoring.
4. Update `useActiveRunSnapshot` inputs and controller hydration (`currentScreen`, etc.).
5. Run storage/migration tests (see AGENTS.md).
