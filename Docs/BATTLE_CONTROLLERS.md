# Battle controllers and presentation

Architecture index: [ARCHITECTURE](./ARCHITECTURE.md). Engine rules: [GAME_RULES](./GAME_RULES.md#engine-invariants).

## Battle path

Controller composition supplies callbacks; screens do not construct controllers. Battle outcome handlers are constructed before the battle controller and passed directly, without ref-backed late binding. `shell/run-flow-engine.ts` composes framework-independent command factories; `use-alchemy-run-controller.ts` provides React lifetime and display reads:

```text
useAlchemyRunController → useBattleController → routeCommands.battle
App → renderAlchemyScreenRoute → BattleScreenRoute → BattleScreen (command props)
```

`App` supplies the session and its owned presentation store to the run controller.
`useBattleController` requires both explicitly, binds `createBattleCapabilities`
once, and passes it as `BattleControllerContext.battle` to the playback factories. Card, Wish, end-turn,
opening-draw, and cancellation callbacks read and command that bound career;
they never import the application singleton. Session ownership is checked when
flow factories connect outcomes and gameplay callbacks.

`getBattleOutcome` in `lib/battle/battle-outcome.ts` classifies the committed
snapshot for both live settlement and simulation. Playback and command gates
use the same policy; they do not infer completion independently from Health.

Card, Wish, and end-turn commands require the borrowed immutable snapshot that
offered the input. The command compares its identity with the current battle
inside the transaction, before resolving gameplay, consuming RNG, or awarding XP.
A retained action cannot affect a later turn, Wish queue, replacement battle, or
restored save even when card IDs and turn numbers repeat. Unrelated navigation
leaves the battle snapshot intact and does not invalidate input. Autoplay retains
its snapshot across preview delays; headless offers retain it in their callbacks.
The battle route binds manual Card and Wish callbacks to the committed input
snapshot captured for that render, separately from copied playback frames.
Autoplay retains the snapshot used to select
its card, and automatic turn endings retain the snapshot that scheduled their
timer. The corner End Turn button passes its captured snapshot
to `handleEndTurn(expected)`; all input handlers require that identity and reject
a changed snapshot before playback. End Turn commits directly after the current playback and save gates pass.

`battle-presentation-store.ts` keeps its mutable Zustand store private. The public
port exposes React-compatible reads and selector subscriptions; every action in
read and subscription snapshots is bound to the owning session. Borrowed actions
are revoked on disposal, which resets effects and releases all subscriptions.
Display frames, ghosts, and transfers are copied on ingress, and roots and nested
data are frozen before publication. Functional transfer updates receive immutable
prior data. Observers receive queued publications in order; a failed observer
cannot interrupt another observer or the action's resource cleanup. Disposal revokes
remaining captured listeners and queued publications before resetting private state;
that final cleanup does not notify consumers of the closed session.

At interaction time, those callbacks resolve gameplay before presentation:

```text
BattleScreen action → supplied battle command → command draft → lib/battle
                    → committed snapshot + detached frames → presentation playback
BattleScreenRoute → useBattleScreenRouteData → displayed frame, active combat, or retained outgoing display
                  → useBattlePlayback → autoplay / auto-end-turn / playback binding
```

- `useAlchemyRunController` exposes battle **commands** on `routeCommands.battle`. Battle **display** is local to `BattleScreenRoute` via `useBattleScreenRouteData`, which selects the current presentation frame or active combat and retains its outgoing data during settlement and fades. `createBattleSession` publishes the terminal presentation frame before calling an outcome command; clearing feedback cannot replace the outgoing enemy or hand with default data.
- Autoplay / auto-end-turn **ticks** live in `useBattlePlayback` on that route. Session autoplay on/off lives in `useBattleController`. Playback how-to: [WORKFLOWS § Change battle playback](./WORKFLOWS.md#change-battle-playback).
- `createBattlePresentationStore(gameSession)` creates an independent presentation store.
  `app/battle-presentation.ts` composes the shipping instance; the controller,
  route data, opening draw, autoplay gates, hand and visual effects all receive
  that same store through explicit props. Playback factories read it through
  `getPresentation`, with no global fallback. Visibility and clear/teardown
  subscriptions belong to its session; session disposal resets presentation
  and cancels feedback timers. Presentation leaves subscribe only to their
  supplied store. Teardown follows committed store `screen !== "battle"` (not `renderedScreen`). `App.tsx` passes `routeCommands` through `renderAlchemyScreenRoute`. Run/battle bindings stay on props; the allowed providers are `AppScreenChromeProvider` and `CardDescriptionProvider`, while presentation-only state may use `ui-store`. See [Content authoring § Add a new card](./CONTENT_AUTHORING.md#add-a-new-card) for card-description context.

### Data flow

Battle launching uses the required `BattleStartCommands` contract inferred from
`shared/stores/commands/battle-start-commands.ts`. Campaign, Labyrinth, Wildwood, the React
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
- **Screen transition:** `navigateTo` delegates to `transition`; [navigation timing](#navigation-timing) separates gameplay preparation, save acknowledgement, display navigation, and the rendered fade.
- **Run-loop screens:** `screen-routes` call their screen-specific read hook for display props; `routeCommands` from the shell controller provide actions.
- **Route registration:** phase tables register statically imported React components directly. Each component takes its phase route context and selects its commands there; `SCREEN_ROUTES` checks completeness for every `Screen`. `renderAlchemyScreenRoute` mounts the selected component with JSX inside the screen error boundary, so React owns its hooks and lifetime. Do not invoke registry entries as ordinary functions or add a second prop-adapter registry.
- **Navigation input:** `useScreenTransitions` exposes transient `navigationPending` through `AlchemyRunCommands`. It spans the save wait and presentation delay, clears on display commit/cancellation, and is never persisted. App input remains inert until this flag clears, the rendered screen matches the committed screen, and mounted artwork is ready. Global Escape Back and menu-opening shortcuts follow the same gate; active dialogs and an already-open menu remain dismissible. Outgoing run-end summaries retain their screen data when teardown clears the live run.
- **Opening draw readiness:** `run-loop/battle/use-battle-opening-draw.ts` waits for playback binding and mounted refs; the session adapter reconciles screen entry, outcome settlement, and teardown. Opening-hand gameplay is committed before this presentation hook runs.

### Navigation timing

`transition` is validated, delayed navigation; `navigateTo` is its convenience
wrapper, and `goToScreen` also clears card hover. Flow navigation clears hover by
construction. `createScreenNavigation` in `shell/screen-navigation.ts` owns this sequence:

1. Check the guard, then validate the interactive edge against
   `ALLOWED_SCREEN_TRANSITIONS` in `src/lib/routing/screen-transition-policy.ts`.
   A guarded no-op stays silent, even on a disallowed edge. Resume uses its
   separate validated resume policy. Cold startup restores progress at the main menu; Continue opens the validated saved activity.
2. Cancel the previous presentation request and run `prepare` synchronously.
   Domain commands commit gameplay and `session.activity` together. Navigation
   never infers an activity from the target screen or initializes a visit. A
   redirect from a guard, screen reader, pending-state notification, preparation,
   or feedback supersedes the older request. Each callback checks the revision it
   entered with; cancellation notifications cannot lend a newer request's revision
   to an older caller.
3. For prepared transitions and battle/reward/run-end progression routes, wait
   through the session's `afterProgressSaved` gate before starting the presentation
   delay. A pending or failed save keeps the route pending; Retry saves the
   committed outcome without executing preparation again. With no pending save,
   the gate continues immediately. See [local saving](./RUN_STATE.md#completed-actions-and-local-saving).
4. Wait for `delayMs` or `NAVIGATION_DELAY_MS`, then write `navigation.screen`.
   Transition options are captured at admission, so caller mutations during the
   save wait cannot change timing or preparation. `immediate` skips this delay;
   it does not bypass the save gate. The rendered
   fade and mounted-artwork readiness run separately, retaining outgoing route
   data and never committing gameplay.

Cancellation and hook unmount invalidate pending presentation, including a
save-gated continuation, without undoing completed gameplay or its save.
Navigation subscriptions are created after React commits and released on owner
replacement or unmount. A retained command from a released owner cannot prepare
gameplay or schedule another screen. Strict Mode effect replay creates a fresh
owner without retaining the preceding owner's restore subscription.

## Playback lifetime and gameplay commands

`run-loop/battle/playback-lifetime.ts` owns opening, ready, playing, finishing,
and cancelled phases, plus the generation, abort signal, timers, transfer
cancellation, draw counts, and autoplay binding. End-turn input is accepted only
while ready; manual card plays may overlap card-draw presentation and remain
available during victory grace. Late completions cannot unlock a newer lifetime
or restart auto-end-turn in a finishing battle. Lifetime subscriptions publish
phase changes so End Turn updates when opening or action playback completes,
even after the final presentation update. React subscribes to binding
readiness. Each generation is a distinct record containing its phase, abort
controller, timers, cancellation callbacks, and draw counts. Phase admission
requires the originating generation ID and reports rejection if an autoplay
adapter or observer replaces it reentrantly. Callers stop presentation after
rejection. Raw timer groups stay private; generation-scoped cleanup cannot
cancel a replacement battle's timers. Autoplay binding replacement separately
rejects an older bind if its cleanup installs a newer binding.

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
Lifetime cancellation revokes the generation before releasing timers, transfers,
draw leases, and autoplay work, then notifies observers. Cleanup and observer
failures are reported independently so one adapter cannot strand another task
or prevent a replacement battle from becoming ready.
Consumers supply cancellation fallbacks and presentation work; they do not
reimplement completion flags or unregister/timer/frame cleanup ordering.
`PlaybackLifetime.capture(generation)` supplies revocable scheduling and cancellation
capabilities. Transfer and draw dependencies are created for the generation that
started the sequence; retained dependencies cannot acquire the replacement battle's
resources. Their UI writes, measurements, completion callbacks, and delayed sounds
also check that scope. Cancellation releases owned overlays before the replacement
presentation starts; abandoned continuations cannot clear the new transfer gate.

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
Session reset cancels and clears presentation without publishing a gameplay
command or retaining an unused opening snapshot in the run store.

## Playback and automation rules

### Autoplay selection and scheduling

`battle/playable-hand.ts` owns Card/Wish picks (`findBestPlayableHandCard`,
`findBestWishChoice`). Autoplay excludes potentially lethal self-costs, then chooses the highest
`getEffectiveDamageScore`, breaking ties leftward. At half Health or below it
restricts hand picks to defensive cards when any are playable. Wishes prefer
safe choices, fall back to the whole offer if none are safe, and preview on hover.
`src/lib/battle/autoplay-policy.ts` owns live scoring and is shared by the balance
simulator; independent simulation policies stay in the simulator.

`use-battle-autoplay.ts` selects a ready action; `battle/autoplay-driver.ts`
(`driveAutoplay`) schedules one loop without owning selection or input gates.
Readiness/retry updates cannot shorten the post-play pause, measured from successful
play start. Transfer time counts toward it; a longer transfer adds no extra pause.
Teardown cancels either wait. Recheck current playback gates before the next play.

Previews are uncommitted. The route forwards the driver's abort signal and live
eligibility check to the card handler. Disabling autoplay or unmounting cancels
preview; after its delay recheck session/input eligibility before committing.
Cancelled work cannot clear a newer preview.

### Manual input, draws and automatic turn ending

Manual plays commit immediately during other draws or hand reflow; only incoming
hidden cards and actual turn transitions are unavailable. Resolve cards by stable
hand identity. Preserve immutable hidden-hand keys and callback binding.
Autoplay, auto-end-turn and End Turn share `isBattlePlaybackBlocked` in
`battle/playback-gate.ts`. Each action goes through `presentCombatTexts` in
`battle/controller-utils.ts` under [battle feedback](./UI_BATTLE.md#battle-feedback).

Concurrent draws preserve one another's hidden cards and transfers; settlement
checks current battle state. Explicitly schedule auto-end after draws/resume,
independently of React battle-state ticks. Opening Menu cancels the countdown;
closing it starts a fresh normal countdown only if eligible. On expiry, recheck
current playback gates and hand playability.

Wishes wait for active card transfers. Draw-and-Wish cards show draws first;
queued Wishes also wait for the prior chosen card to reach the hand. Use the
existing transfer-in-progress signal without delaying gameplay commits.

### Outcome timing

Defeat settles synchronously in transition `prepare`; only navigation waits.
Retain the terminal frame through delay/fade under [data flow](#data-flow).
Keep [battle timing](../src/lib/game-constants/battle-timing.ts) aligned with
`combatant-attack-lunge` in [keyframes](../src/styles/keyframes.css) and the shake
delay in [theme styles](../src/styles/theme.css). [Battle motion](./UI_MOTION.md#battle-motion)
owns death, survival and lunge composition. Mid-enemy-turn reload skips playback
under [committed battle recovery](./RUN_STATE.md#committed-battle-playback).
