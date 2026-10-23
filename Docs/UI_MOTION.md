# UI motion

Canonical detail linked from [UI.md](./UI.md).

Screen-specific Homestead purchase feedback lives with its
[gallery interaction](./UI_BROWSING.md#purchase-motion).

## Screen fade motion

- **Route change** — `useRenderedScreenTransition` owns the opacity-only page fade. Save payloads follow the committed run activity; audio, battle playback, and presentation teardown follow committed `screen`, not `renderedScreen`.
- **In-screen identity** — Use `FadeSlot` for tabs, shop modes, offerings, keyword trees, and other identity swaps. Its first mount is idle so it does not stack on the route fade.
- **Overlays** — Dialogs, wish, and the game menu use `useFadePresence` so exit completes before unmount.
- **Copy** — `ScreenDescription` is static. `TextAnimate` is reserved for mystery narrative.
- **Anti-flash** — Commit gameplay independently of animation; hold outgoing display snapshots until the rendered screen changes, swap layout while opacity is zero, reserve height for shape-changing swaps, and keep shell chrome mounted when payload data clears. Do not stagger route content.

Screen and `FadeSlot` reveals wait for the mounted images to load and decode through `useArtworkReady`, then allow a layout frame before starting the fade. While preparing a reveal, the gate also tracks artwork inserted after layout measurement and changed image sources; stale decode completions cannot reveal or hide the replacement. `FadeSlot` uses the initial-reveal mode: later artwork waits individually without hiding or making the already visible screen inert again. The observer continues to track replacement sources and removed images. Startup preloading is a warm-up, not proof that a later mounted image is paint-ready. Failed or timed-out images stay hidden for that mount so they cannot pop in after the screen is revealed. Reserve intrinsic artwork dimensions when image height determines layout, including the menu logo.

The pre-React splash uses the parser-blocking external script
`public/startup-preferences.js` before its markup to apply preferences and scale.
Localized phrase rotation starts in `src/app/startup-splash.ts` once catalogs and
the selected language are ready. Its caption is 12px at the reference viewport
and scales proportionally with the game. Startup scripts remain external under
the packaged desktop policy, which blocks inline JavaScript.

Startup preloading and mounted artwork share [image readiness](../src/lib/preload/image-readiness.ts), which owns load/decode completion, the timeout, and listener cleanup. The reveal gate retains each image's wait until its source changes or it leaves the screen; unrelated DOM changes do not restart its deadline.

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
the visible refill. Use `CAMPFIRE_ANIMATION_MS` from
[ui-motion](../src/lib/game-constants/ui-motion.ts).

Hero Unlocked reveals the decoded portrait once per hero with a 560ms fade,
small upward settle, and 98% to 100% scale. The name and Continue/Main Menu
button remain immediately available; the reveal never delays navigation or
grants progression. Reduced or disabled motion shows the portrait without the
reveal animation.

Reward selection immediately holds the chosen frame, with one 200ms tiny settle
and one simultaneous 220ms artwork shine. Alternatives gently dim. Selection
suppresses any hover shimmer; saving and the existing outgoing fade proceed
independently, with no second shine or added wait. Each reward-choice identity
starts fresh. Reduced or disabled motion keeps the selected frame and dimming.

Transmutation keyword choices use opaque fills, 24px icons, hover/focus illumination,
press feedback, and a selected 2px shine border in the keyword palette. The preview
card and its title swap together through `FadeSlot`; the original stays steady.
Transmute stays disabled until the current preview artwork is ready. Choices remain
available during the swap. The saved result uses the reward settle/shine once on
live completion and waits for Continue; resumed results skip that reveal effect. Reduced or
disabled motion preserves selection emphasis without decorative animation.

## Battle motion

Living combatant artwork, including Companions, enlarges during its active turn
alongside the shine border. Hover multiplies that active size. Exact scale and
transition values belong to [component styles](../src/styles/components.css).

This guide owns visible battle feedback; [the playback workflow](./WORKFLOWS.md#change-battle-playback)
owns wiring and lifecycle. Battle VFX live in `run-loop/battle` (visual state in
`battle-presentation-store.ts`, overlays in `presentation/` leaves); every fight
action presents numbers + shake + sound through `presentCombatTexts` in
`battle/controller-utils.ts`.

Player lunges occur only for cards with a damage effect and move the portrait,
not the Health/status column. Feedback and the single portrait impact flash appear
as soon as the action resolves, independently of the attack animation. Health
damage takes priority over Block-only impacts; the largest eligible amount wins,
with first occurrence breaking ties. Portrait recoil has light, normal, and heavy
strengths: below 5%, from 5%, and from 20% of the target's maximum Health per
selected impact. Block and periodic damage always use light recoil. Recoil stays
on artwork, leaving Health and statuses steady; at most one recoil starts per
target every 180ms. Every resolved impact still retains its flash, numbers, and
sound. These effects never delay input. Each action requests each combat sound family
at most once. Player and enemy deaths share the slice effect and battle-end delay;
Death's Door is not defeat, and voluntary run exits remain immediate.

Player and enemy dodges use a mirrored, shallow dip and backward lean on the
artwork frame, easing back over 460ms without hit recoil or an added effect.
Health and statuses stay steady. Existing floating Dodge text and sounds remain
unchanged. Dodge motion never delays input; another dodge replaces the previous
motion, and reset, death, teardown or reduced/disabled motion cancels it.

The shared death effect uses a straight diagonal cut for portrait halves and
particle origins, with a pointed white blade flash and restrained warm halo.
[Battle timing](../src/lib/game-constants/battle-timing.ts) and the effect's styles
own durations. Dark shading and thin warm glints
follow the cut edges as the halves separate and fade; a small directional spark
burst accompanies the cut, followed by the existing border dissolve. Motion-disabled
preferences skip the effect and its sound cue.

Played cards fly as artwork and finish with a small pop before fading on
arrival, marking the activation. At most six flight ghosts overlap; the oldest
sheds first. Motion-disabled preferences skip the flight.
Autoplay flashes the hover lift, scale, and shine for a beat before committing,
without the description popup; reduced motion plays instantly with no preview.
Cancelling or restarting the battle clears its pending autoplay preview immediately
and prevents that preview from committing a card or Wish choice.

Draws fly from the bottom-left Draw Pile into measured hand slots and flip from
back to front. Discards leave right-to-left, flip onto the bottom-right Discard
Pile, and scale to its top card. Both follow the shallow curved path in
[transfer motion](../src/features/alchemy/run-loop/battle/presentation/card-transfer-motion.ts),
with batch-accelerated timing. Flights run sequentially;
each departure starts its sound. The live card identity follows hand reflow.
Tuning lives in `CARD_TRANSFER_CONFIG`.

Existing playback owns batch completion, input gates, hidden-card handoff,
cancellation, and timers. A batch waits for its last flight rather than pausing
between cards. Reduced or disabled motion settles immediately. Cancellation
revokes pending departures, flights, and sounds; absent geometry cannot leave a
committed card hidden. Played cards retain their travel, pop, and fade animation.

### Equipment movement animations

When equipping, unequipping, or replacing gear and trinkets:

- **Transfer animation**: Artwork flies between inventory and equipment through
  the unclipped [ArmoryTransferOverlay](../src/features/alchemy/meta/screens/armory/armory-transfer-overlay.tsx),
  which owns duration and easing.
- **Artwork visibility**: During the in-flight transfer, destination artwork remains hidden (`opacity-0`) to prevent visual duplication until the animation completes and the transfer settles.
- **Position reflow**: When an empty-slot equip, unequip, or hand displacement causes inventory items to shift, surrounding items animate to their new positions using layout position transitions (`motion.div layout="position"`).
- **Interruption safety**: Any navigation, category switch, slot change, window resize, scroll, or unmount immediately settles all active in-flight transfers, restoring artwork visibility and removing portaled overlays without lingering visual artifacts.
- **Reduced motion**: When reduced motion is preferred (`prefers-reduced-motion: reduce`), transfers settle immediately with zero travel duration and no portaled flight overlay.

## Canvas rendering

Canvas decorations share [the canvas lifecycle](../src/lib/animation/canvas-lifecycle.ts):
background particles, combatant status effects, and keyword plasma use its resize,
frame pacing, and pause/resume policy. The canvas owns backing dimensions; unchanged
sizes must not clear its drawing state. Disposal aborts event listeners, cancels
the queued frame, and disconnects resize observation; late callbacks do nothing.
Stun and Freeze presentation rebuilds when the shared motion preference changes,
switching between a static overlay with no tilt and the animated effect.

Plasma uses [keyword-plasma.ts](../src/lib/animation/keyword-plasma.ts) as its
single WebGL entry point. Context/shader failure or context loss shows a static
CSS gradient matching interaction colors, focal offset, blending and intensity;
hide it while WebGL works to avoid doubling glow. Restore rebuilds resources once,
without polling or a second animated backend. Failed startup keeps the fallback
and may retry on context restoration. Zero intensity hides both layers;
motion-disabled preferences schedule no color-animation frames.

Construction owns rollback until it returns its disposer.

| Event                    | Resource guarantee                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Construction failure     | Roll back scheduled frames and observers/listeners; plasma also releases allocated shaders, buffers and programs |
| Disposal                 | Idempotently attempt all cleanup, even if a wake adapter fails                                                   |
| Context replacement      | Revoke the old renderer before host callbacks                                                                    |
| Observer/adapter failure | Log startup, teardown and availability failures independently; no player-facing dialog                           |

Hover/leave retarget colors immediately through a critically damped transition
that retains momentum; object highlights remain immediate. Both renderers use
clamped Background Glow times `GLOW_BRIGHTNESS` from
[KeywordPlasmaBackground](../src/features/alchemy/shared/ui/keyword-plasma-background.tsx).
[The WebGL implementation](../src/lib/animation/keyword-plasma-webgl.ts) owns frame
pacing and backing-pixel limits. Preserve its single render pass and opacity
dithering without a higher-resolution output pass. Banding depends on compositing
and display; panel technology is not detected.
