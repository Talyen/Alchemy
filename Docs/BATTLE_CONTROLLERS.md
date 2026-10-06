# Battle controllers and presentation

Architecture index: [ARCHITECTURE](./ARCHITECTURE.md). Engine rules: [GAME_RULES](./GAME_RULES.md#engine-invariants).

## Battle path

Controller composition supplies callbacks; screens do not construct controllers. Battle outcome handlers are constructed before the battle controller and passed directly, without ref-backed late binding. `shell/run-flow-engine.ts` composes framework-independent command factories; `use-alchemy-run-controller.ts` provides React lifetime and display reads:

```text
useAlchemyRunController → useBattleController → routeCommands.battle
App → renderAlchemyScreenRoute → BattleScreenRoute → BattleScreen (command props)
```

At interaction time, those callbacks resolve gameplay before presentation:

```text
BattleScreen action → supplied battle command → command draft → lib/battle
                    → committed snapshot + detached frames → presentation playback
BattleScreenRoute → useBattleScreenRouteData → displayed frame, active combat, or retained outgoing display
                  → useBattlePlayback → autoplay / auto-end-turn / playback binding
```

- `useAlchemyRunController` exposes battle **commands** on `routeCommands.battle`. Battle **display** is local to `BattleScreenRoute` via `useBattleScreenRouteData`, which selects the current presentation frame or active combat and retains its outgoing data during settlement and fades. `createBattleSession` publishes the terminal presentation frame before calling an outcome command; clearing feedback cannot replace the outgoing enemy or hand with default data.
- Autoplay / auto-end-turn **ticks** live in `useBattlePlayback` on that route. Session autoplay on/off lives in `useBattleController`. Playback how-to: [WORKFLOWS § Change battle playback](./WORKFLOWS.md#change-battle-playback).
- Presentation leaves subscribe to `battle-presentation-store`. Teardown follows committed store `screen !== "battle"` (not `renderedScreen`). `App.tsx` passes `routeCommands` through `renderAlchemyScreenRoute`. Run/battle bindings stay on props; the allowed providers are `AppScreenChromeProvider` and `CardDescriptionProvider`, while presentation-only state may use `ui-store`. See [Content authoring § Add a new card](./CONTENT_AUTHORING.md#add-a-new-card) for card-description context.

### Data flow

Battle launching uses the required `BattleStartCommands` contract inferred from
`shared/stores/battle-start-commands.ts`. Campaign, Labyrinth, Wildwood, the React
controller, and headless playthroughs share its named options; shell adapters do
not redeclare positional arguments or accept alternate callback names. Launch
options select the encounter and difficulty; the command reads the deck and Gold
from its live draft after run initialization. `resolveBattleStart` owns opening
Companions and drawing in the engine; the start command settles its Gold delta
against the live purse and records earnings in the same transaction before
publishing presentation feedback. Random boss selection and explicit
boss validation remain separate commands.
Campaign and Labyrinth enter through `enterRunRoom`, composing the same battle
initialization operation with room progress and traits inside one transaction.
The shell schedules Battle after acceptance and then calls `presentBattleStart`
with detached opening feedback. If a Companion immediately ends combat, its
outcome navigation supersedes the Battle request; history already exists when
victory or defeat settles. Destination and Labyrinth map routing allow Rewards
directly when opening combat ends before the Battle fade commits.
Initialization errors roll back room entry; later
presentation errors retain the complete committed room.

Readiness and saving use [Boot and loading](./ARCHITECTURE.md#boot-and-loading) and the [Persistence API](./RUN_STATE.md#persistence-api).

- **Combat feedback:** each presentation call is one resolved action batch. The pure `combat-feedback-model.ts` copies and prepares events; `combat-feedback-merge.ts` consolidates them across actions into ephemeral `CombatTextBurst` records (identity, target, typed entries, lifetime); burst state is never persisted or used for gameplay. `combat-feedback.ts` owns a per-store lifetime for expiry timers, shake replacement, telegraphs, and feedback identities. The presentation store supplies visibility and clock reads and cancels that lifetime before atomically resetting all visible presentation state. Clearing combat text only cancels text expiry; full reset also cancels shakes. Enemy-turn start, ability resolution, and separately presented Companion actions retain their batch boundaries, including immediate battle-ending presentation.
- **Screen transition:** `navigateTo` → `transition` → guard check, then `assertScreenTransitionAllowed()` → gameplay preparation and `session.activity` → delayed `navigation.screen` → `renderAlchemyScreenRoute()`. Interactive transitions use the exhaustive `ALLOWED_SCREEN_TRANSITIONS` table in `src/lib/routing/screen-transition-policy.ts`; boot restore/hydration bypasses that policy after save validation. `createScreenNavigation` checks its guard first (a guarded no-op stays silent even on a disallowed edge), then validates, before cancelling pending presentation. It runs an explicit `prepare` callback synchronously; the domain commands in that callback commit gameplay and its activity together, so saves and subsequent commands see the completed gameplay even before the screen appears. Navigation never infers an activity from the target screen or initializes a visit. Showing a screen only writes the display location. Only presentation waits for `delayMs` or `NAVIGATION_DELAY_MS`; `immediate` takes precedence. A redirect during preparation supersedes the original request. Cancellation and hook unmount clear pending presentation timers without undoing completed gameplay. The rendered-screen fade runs independently and never commits gameplay; activity route data retains its outgoing snapshot for that fade.
- **Run-loop screens:** `screen-routes` call their screen-specific read hook for display props; `routeCommands` from the shell controller provide actions.
- **Route registration:** phase tables register statically imported React components directly. Each component takes its phase route context and selects its commands there; `SCREEN_ROUTES` checks completeness for every `Screen`. `renderAlchemyScreenRoute` mounts the selected component with JSX inside the screen error boundary, so React owns its hooks and lifetime. Do not invoke registry entries as ordinary functions or add a second prop-adapter registry.
- **Navigation input:** `useScreenTransitions` exposes transient `navigationPending` through `AlchemyRunCommands`. It spans the prepared destination's presentation delay, clears on commit/cancellation, and is never persisted. App input remains inert until this flag clears, the rendered screen matches the committed screen, and mounted artwork is ready. Global Escape Back and menu-opening shortcuts follow the same gate; active dialogs and an already-open menu remain dismissible. Outgoing run-end summaries retain their screen data when teardown clears the live run.
- **Opening draw readiness:** `run-loop/battle/use-battle-opening-draw.ts` waits for playback binding and mounted refs; the session adapter reconciles screen entry, outcome settlement, and teardown. Opening-hand gameplay is committed before this presentation hook runs.

## Playback lifetime and gameplay commands

`run-loop/battle/playback-lifetime.ts` owns opening, ready, playing, finishing,
and cancelled phases, plus the generation, abort signal, timers, transfer
cancellation, draw counts, and autoplay binding. End-turn input is accepted only
while ready; manual card plays may overlap card-draw presentation and remain
available during victory grace. Late completions cannot unlock a newer lifetime
or restart auto-end-turn in a finishing battle. React subscribes to binding
readiness; no callback-ref bundle or binding-version counter is needed.

Hand reveals acquire a draw lease from this lifetime and release it on success,
failure, or cancellation. Transfer visibility reads the same pending count; it
never depends on a dependency object's identity. Card-action draw leases separately
gate completion of overlapping card plays. Animation-frame waits belong to the
lifetime and settle on cancellation even if the browser never delivers a frame.
`playback-task.ts` owns single settlement and resource cleanup for frame waits,
stable hand measurements, and timed card transfers. Each task registers with the
existing lifetime, owns its visible transfer and pending callbacks, and releases
them before completion or cancellation. Scheduling after settlement does nothing;
cleanup returned by a synchronous completion is released immediately. Callback
failures reject the task after cleanup rather than leaving a draw suspended.
Consumers supply cancellation fallbacks and presentation work; they do not
reimplement completion flags or unregister/timer/frame cleanup ordering.
`draw-sequence.ts` owns sequencing; `battle-transfers.ts` adapts DOM measurements,
sounds, and transfer timers. End-turn cleanup resets hand transfer UI only after
all animated draws have settled.

`battle-session.ts` reconciles committed screen changes. Leaving battle cancels
the old lifetime; returning displays committed gameplay. A new battle prepared
before its navigation fade commits retains its opening sequence. Terminal restored
snapshots settle through the same victory/defeat callbacks as live battles.
`battle-context.ts` supplies DOM refs and updates the stable controller's inputs
after each React commit. Store commands own gameplay; hydration consumes legacy
continuations before the UI observes a battle.
