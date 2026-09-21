# UI motion

Canonical detail linked from [UI.md](./UI.md).

## Screen fade motion

- **Route change** — `useRenderedScreenTransition` owns the opacity-only page fade. Save payloads follow the committed run activity; audio, battle playback, and presentation teardown follow committed `screen`, not `renderedScreen`.
- **In-screen identity** — Use `FadeSlot` for tabs, shop modes, offerings, keyword trees, and other identity swaps. Its first mount is idle so it does not stack on the route fade.
- **Overlays** — Dialogs, wish, and the game menu use `useFadePresence` so exit completes before unmount.
- **Copy** — `ScreenDescription` is static. `TextAnimate` is reserved for mystery narrative.
- **Anti-flash** — Commit gameplay independently of animation; hold outgoing display snapshots until the rendered screen changes, swap layout while opacity is zero, reserve height for shape-changing swaps, and keep shell chrome mounted when payload data clears. Do not stagger route content.

Screen and `FadeSlot` reveals wait for the mounted images to load and decode through `useArtworkReady`, then allow a layout frame before starting the fade. While preparing a reveal, the gate also tracks artwork inserted after layout measurement and changed image sources; stale decode completions cannot reveal or hide the replacement. The observer disconnects after reveal, so normal battle updates do not restart the whole-screen gate. Startup preloading is a warm-up, not proof that a later mounted image is paint-ready. Failed or timed-out images stay hidden for that mount so they cannot pop in after the screen is revealed. Reserve intrinsic artwork dimensions when image height determines layout, including the menu logo.

Opacity fades use reversible CSS transitions, so an interrupted reveal exits from
its current opacity instead of restarting at full opacity. The first changed render
already carries the exit phase. Screen input, including external battle chrome, stays
blocked during pending navigation (`navigationPending` from `useScreenTransitions`),
the outgoing fade, and incoming artwork preparation.

`FadeSlot` keeps outgoing and artwork-pending content inert. Identity-dependent
headings, prompts, resources, and actions must travel with their content: Victory
reward prompts/Skip share the reward-kind-and-choice identity, and Mystery titles
share the event-and-phase identity. Corruption phases and Armory slot headings use
the same boundary as their choices. An identity swap remounts the `FadeSlot` subtree,
so nested fades cannot retain a previous identity beneath a new heading; state that
must survive a swap belongs above that boundary. Labyrinth selection and run-end
summaries retain their display data while navigation or teardown clears live state.
Do not animate `filter` on artwork whose
state uses grayscale; reveal opacity must settle to the underlying state opacity
rather than force completed art to full color or full opacity.

`useHeldWhile` snapshots its input in an effect. Memoize composite inputs before passing them to the hook; fresh objects can trigger repeated rendering in environments without React Compiler.

Motion tokens live in `src/lib/game-constants/ui-motion.ts` (`MOTION_FADE_MS`, `TOOLTIP_FADE_MS`) and are mirrored to CSS as `var(--motion-fade-duration)` and `var(--tooltip-exit-duration)` in `src/styles/theme.css` / `src/styles/components.css`. Keep each JS duration and its CSS counterpart in sync; `npm run lint:architecture-smoke` asserts this.

Campfire snapshots the starting and restored Health when Rest is pressed. Its number
and bar share an eased refill, then hold the exact result before continuing. Keep
that snapshot through the outgoing screen fade so applying the heal cannot restart
the visible refill. Use `CAMPFIRE_ANIMATION_MS` and `CAMPFIRE_CONTINUE_DELAY_MS` from
[battle timing](../src/lib/game-constants/battle-timing.ts).

## Battle motion

Living combatant artwork, including companions, scales to 103.5% during its active
turn alongside the shine border. Standard hover scaling multiplies that size by
1.035 again (about 107.1% total), with the shared 200ms ease-out transition.

This guide owns visible battle feedback; [the playback workflow](./WORKFLOWS.md#change-battle-playback)
owns wiring and lifecycle. Battle VFX live in `run-loop/battle` (visual state in
`battle-presentation-store.ts`, overlays in `presentation/` leaves); every fight
action presents numbers + shake + sound through `presentCombatTexts` in
`battle/controller-utils.ts`.

Player lunges occur only for cards with a damage effect and move the portrait,
not the Health/status column. Feedback and the single portrait impact flash appear
as soon as the action resolves, independently of the attack animation. Health
damage takes priority over Block-only impacts; the largest eligible amount wins,
with first occurrence breaking ties. Each action requests each combat sound family
at most once. Player and enemy deaths share the slice effect and battle-end delay;
Death's Door is not defeat, and voluntary run exits remain immediate.

Played cards fly as artwork and finish with a small pop before fading on
arrival, marking the activation. At most six flight ghosts overlap; the oldest
sheds first. Motion-disabled preferences skip the flight.
Autoplay flashes the hover lift, scale, and shine for a beat before committing,
without the description popup; reduced motion plays instantly with no preview.

### Equipment movement animations

When equipping, unequipping, or replacing gear and trinkets:

- **Transfer animation**: Artwork flies between its inventory tile and equipment slot across an unclipped, portaled overlay (`ArmoryTransferOverlay`) over 220ms with an ease-out curve (`easeOut`).
- **Artwork visibility**: During the in-flight transfer, destination artwork remains hidden (`opacity-0`) to prevent visual duplication until the animation completes and the transfer settles.
- **Position reflow**: When an empty-slot equip, unequip, or hand displacement causes inventory items to shift, surrounding items animate smoothly to their new positions over 200ms using layout position transitions (`motion.div layout="position"`).
- **Interruption safety**: Any navigation, category switch, slot change, window resize, scroll, or unmount immediately settles all active in-flight transfers, restoring artwork visibility and removing portaled overlays without lingering visual artifacts.
- **Reduced motion**: When reduced motion is preferred (`prefers-reduced-motion: reduce`), transfers settle immediately with zero travel duration and no portaled flight overlay.

## Conditional options

Options uses `SettingsReveal` for toggle-dependent controls. A reversible grid-row
and opacity transition expands/collapses their actual layout height, including
spacing, so the centered shell and following controls move continuously. Closing
makes descendants inert and accessibility-hidden immediately. Reduced motion and
the shared animation-disable flag settle immediately. Hidden controls stay mounted
to support interrupted transitions and retain their selected values.
