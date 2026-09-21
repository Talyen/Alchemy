# UI interaction

Canonical detail linked from [UI.md](./UI.md).

## Hover tooltips

Tooltips render through `PortaledTooltip` into the root-space `#tooltip-root`.
Placement follows the Floating UI standard (`@floating-ui/dom`: preferred side,
then automatic flip to a fitting side, then shift to stay in bounds), bounded to
`[data-testid="vr-stage"]` with `documentElement` as a fallback, so panels keep
an independent CSS-pixel scale and avoid clipped ancestors. Tooltip Size
(90–125%, 5% steps; default 100%) scales text, chrome, and preferred width
together. Enemy tooltip headers, outer padding, and preferred width remain
independent of Game Size. Only the nested Trait list uses the game content scale
as its baseline, matching Labyrinth and inspection Trait text, icons, and spacing;
Tooltip Size also multiplies that baseline. Standard tooltips cap at 20rem of width;
enemy tooltips prefer 32rem of width at the independent tooltip scale to give Trait descriptions room to wrap. Placement recomputes width bounds when the stage or tooltip changes
size; position-only updates preserve the resolved width to avoid forced layout. Long
descriptions can use available width to fit; tooltips never scroll or truncate.

- Drive ordinary hover with `useHoverVisible()` and `triggerRef`. For card/tile grids that already track hover via `useInteractiveCard`, use `useTileHoverPopup` (a `useHoverVisible` preset with the shared `TOOLTIP_FADE_MS` hold) — see those hooks for the exact call shape.
- Use `placement="side-start"` or `"side-end"` for explicitly side-anchored panels.
- Use `maxWidthFraction` for small-window bounds.
- Tooltip entrance fades and moves away from the trigger; exit fades with a return movement. [Component styles](../src/styles/components.css) own the offsets and easing, with durations from [motion constants](../src/lib/game-constants/ui-motion.ts). CSS `@starting-style` supplies the first-render entrance, and transitions reverse smoothly on re-hover. Hover remains immediate for rapid inspection. Keep `--tooltip-exit-duration` in sync with `TOOLTIP_FADE_MS`.
- Tooltip panels are `pointer-events-none`; nested interactive tooltips are unsupported.
- `PortaledTooltip` retains the complete last visible content through fade-out, including descriptions computed only while hovered. Header and body enter and exit as one panel.
- State-driven triggers mount the portal only while hovered; exit fades complete via the shared `TOOLTIP_FADE_MS` hold — do not add a second hold alongside `PortaledTooltip`.
- Fade primitives are consolidated in `src/features/alchemy/shared/ui/use-fade.tsx` (import `FadeSlot`, `useFadePresence`, `useSequentialFadeSwap`, `useHeldWhile` from there directly); placement helpers live in `shared/ui/tooltips/portaled-tooltip-placement.ts`, content slots in `shared/ui/tooltips/tooltip-panel.tsx`. `DisabledTooltip` lives in `shared/ui/tooltips/disabled-tooltip.tsx`.

## Overlay lifecycle

Modals and panels use `useModalEscapeDismiss` or `useCaptureEscapeCancel` so the global Escape stack remains ordered.

`ModalOverlayShell` portals into the app's shared modal host, outside the scaled
battle stage, inheriting the frame's content scale. Its fixed backdrop covers the
viewport regardless of where the modal is opened. Backdrop dismissal only handles
clicks on the backdrop itself; clicks inside content do not dismiss it or activate
underlying screen handlers. Required choices such as Wish remain non-dismissible.
Panels size to their contents with bounded width and height and scroll overflow;
card inspection retains adaptive pagination without reserving an empty full-screen panel.

Draw Pile, Discard Pile, and Deck inspection share the backdrop fade and upward
panel settle defined in [component styles](../src/styles/components.css), using
the shared [motion duration](../src/lib/game-constants/ui-motion.ts). Closing
uses only the fade; reduced motion omits the settle. Cards appear together, and
populated panels retain content-based sizing without animated dimensions. Empty
collections show a centered, muted collection icon in a 10rem-high content area with a
20rem minimum panel width, bounded by the available viewport with overflow scrolling.
Deck, Draw Pile, and Discard Pile use the stacked-cards icon; Boons uses the trophy icon.
Each empty icon is exposed as an image labelled Empty Deck, Empty Draw Pile,
Empty Discard Pile, or Empty Boons.

`ModalOverlayShell` reveals the backdrop immediately and prepares the entire panel
with `useArtworkReady`, including its heading, pagination, and actions. Pending panels
are hidden and inert; dismissible backdrops still accept dismissal. Focus moves inside
only once the actual initial control is visible. Closing during preparation never
reveals a late decode result.

`ModalOverlayShell` owns overlay interaction eligibility: only open, rendered
overlays register an Escape handler, and only ready content accepts input. Closing content remains
visible for its existing fade but is inert and rejects activation events;
Tab keeps its native focus traversal while propagation to inactive controls is blocked;
`mount=false` removes it immediately without retaining an Escape handler.
The shell retains outgoing children and layout classes, so clearing a payload or
resetting pagination cannot change the closing panel. Reopening cancels removal and
starts a fresh panel mount and artwork gate. Consumers retain action-specific guards
such as Wish's single-selection latch and confirmation buttons' disabled state.
Confirmation focus containment pauses while the panel is inert; focus returns
to its existing target when the panel unmounts.
