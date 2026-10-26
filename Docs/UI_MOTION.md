# UI motion

Shared reveal and canvas lifetimes live here. Feature-specific motion stays
with [battle presentation](./UI_BATTLE.md#battle-motion) and
[browsing interactions](./UI_BROWSING.md), including equipment transfers and
Homestead purchases. [UI](./UI.md) owns shared components and sizing.

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
