# Battle controllers and presentation

Architecture index: [ARCHITECTURE](./ARCHITECTURE.md). Engine rules: [GAME_RULES](./GAME_RULES.md#engine-invariants).

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

Readiness and saving use [Boot and loading](./ARCHITECTURE.md#boot-and-loading) and the [Persistence API](./ARCHITECTURE.md#persistence-api).

- **Combat feedback:** each presentation call is one resolved action batch. The presentation store copies and consolidates its events into ephemeral `CombatTextBurst` records (identity, target, typed entries, lifetime); burst state is never persisted or used for gameplay. Enemy-turn start, ability resolution, and separately presented Companion actions retain their batch boundaries, including immediate battle-ending presentation.
- **Screen transition:** `navigateTo` → `transition` → guard check, then `assertScreenTransitionAllowed()` → gameplay preparation and `session.activity` → delayed `navigation.screen` → `renderAlchemyScreenRoute()`. Interactive transitions use the exhaustive `ALLOWED_SCREEN_TRANSITIONS` table in `src/lib/routing/screen-transition-policy.ts`; boot restore/hydration bypasses that policy after save validation. `createScreenNavigation` checks its guard first (a guarded no-op stays silent even on a disallowed edge), then validates, before cancelling pending presentation. It runs `prepare` and commits the activity synchronously, so saves and subsequent commands see the completed gameplay even before the screen appears. Only presentation waits for `delayMs` or `NAVIGATION_DELAY_MS`; `immediate` takes precedence. A redirect during preparation supersedes the original request. Cancellation and hook unmount clear pending presentation timers without undoing completed gameplay. The rendered-screen fade runs independently and never commits gameplay; activity route data retains its outgoing snapshot for that fade.
- **Run-loop screens:** `screen-routes` call their screen-specific read hook for display props; `routeCommands` from the shell controller provide actions.
- **Navigation input:** `useScreenTransitions` exposes transient `navigationPending` through `AlchemyRunCommands`. It spans the prepared destination's presentation delay, clears on commit/cancellation, and is never persisted. App input remains inert until this flag clears, the rendered screen matches the committed screen, and mounted artwork is ready. Global Escape Back and menu-opening shortcuts follow the same gate; active dialogs and an already-open menu remain dismissible. Outgoing run-end summaries retain their screen data when teardown clears the live run.
- **Opening draw readiness:** `run-loop/battle/use-battle-opening-draw.ts` waits for playback binding and mounted refs; the battle controller owns session resume and teardown. Opening-hand gameplay is committed before this presentation hook runs.
