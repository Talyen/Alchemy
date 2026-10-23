# UI interaction

Canonical detail linked from [UI.md](./UI.md).

## Hover tooltips

Tooltips render through `PortaledTooltip` into the root-space `#tooltip-root`.
Placement follows the Floating UI standard (`@floating-ui/dom`: preferred side,
then automatic flip to a fitting side, then shift to stay in bounds), bounded to
`[data-testid="vr-stage"]` with `documentElement` as a fallback, so panels keep
the game's proportional growth without inheriting the stage transform or
clipped ancestors. Tooltips inherit the [shared content/tooltip scale](./UI.md#display-sizing)
once, including enemy headers and Traits; Tooltip Size defaults to 100%.
Standard panels cap at 20 content-scaled rem; enemy panels prefer 32 rem.
Recompute width bounds when the stage or panel changes size; position-only updates
preserve resolved width to avoid forced layout. Long descriptions can use available
width; tooltips never scroll or truncate.

- Drive hover through `useHoverVisible()` and `triggerRef`. Card/tile grids that track hover via `useInteractiveCard` pass its `isHovered`, `onHoverStart`, and `onHoverEnd` to the same hook, with `holdMs: TOOLTIP_FADE_MS` and `focusWithinGuard: true` to preserve the exit fade and keyboard inspection.
- Use `placement="side-start"` or `"side-end"` for explicitly side-anchored panels.
- Use `allowFlip={false}` when a layout owns a fixed side. Homestead places top-row tooltips below and bottom-row tooltips above, preserving that side as purchase feedback changes panel height. Other tooltips retain automatic flipping by default; horizontal bounds still apply to fixed vertical placement.
- The dev-only Skip Combat tooltip stays below its toolbar icon. Use `horizontalInset={8}` for this edge control so the standard wide content inset does not shift its label away from the icon. End Turn is a bottom-bar text button without a tooltip.
- Use `maxWidthFraction` for small-window bounds.
- Tooltip entrance fades and moves away from the trigger; exit fades with a return movement. [Component styles](../src/styles/components.css) own the offsets and easing, with durations from [motion constants](../src/lib/game-constants/ui-motion.ts). CSS `@starting-style` supplies the first-render entrance, and transitions reverse smoothly on re-hover. Hover remains immediate for rapid inspection. Keep `--tooltip-exit-duration` in sync with `TOOLTIP_FADE_MS`.
- Passive tooltip panels are `pointer-events-none`; nested interactive tooltips are unsupported.
- `PortaledTooltip` also checks document-level pointer and focus input while requested open. Outside input, window blur, and leaving the window dismiss stale panels even when a trigger misses its leave/blur event. Pointer movement and exit preserve keyboard inspection while the trigger has visible keyboard focus in the active window. Click-retained focus does not keep a tooltip open after pointer exit; the hover owner and focus-only visual effects use the same focus-navigation mode as automatic recovery. Outside presses, mouse-wheel scrolling, and window blur still dismiss it. Inert or hidden ancestors dismiss retained tooltip portals even without further input, including during modal exit. Returning to the window or reactivating an ancestor alone does not revive a dismissed panel; fresh pointer inspection or keyboard focus can reveal it again. Hand cards retain their geometry-selected preview across gaps inside the hand. Dismissal preserves the normal exit fade and removes the tooltip's accessibility association.
- Tooltip panels expose `role="tooltip"`. `PortaledTooltip` associates its stable ID with the trigger and focused controls inside a trigger wrapper through `aria-describedby`, preserving other descriptions and removing only its own association when hidden or unmounted. Locked menu entries and unavailable shop services reveal their reasons on focus; hero keyword pills and the active Companion remain focusable for inspection. Tabs expose their selected state through `aria-pressed`.
- `PortaledTooltip` retains the complete last visible content through fade-out, including descriptions computed only while hovered. Header and body enter and exit as one panel.
- State-driven triggers mount the portal only while hovered; exit fades complete via the shared `TOOLTIP_FADE_MS` hold — do not add a second hold alongside `PortaledTooltip`.
- Fade primitives are consolidated in `src/features/alchemy/shared/ui/use-fade.tsx` (import `FadeSlot`, `useFadePresence`, `useSequentialFadeSwap`, `useHeldWhile` from there directly); placement helpers live in `shared/ui/tooltips/portaled-tooltip-placement.ts`, content slots in `shared/ui/tooltips/tooltip-panel.tsx`. `DisabledTooltip` lives in `shared/ui/tooltips/disabled-tooltip.tsx`.

## Overlay lifecycle

An open game menu switches to its centered presentation when the window resizes,
discarding its stale hamburger anchor while keeping combat paused.

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
Battle opens only the clicked pile with a centered pile title and no collection tabs;
its panel sizes to that pile within the viewport. Outside battle, Deck retains
content-based sizing.
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
`dialog-focus-owner.ts` owns the ordered interactive panel stack, focus containment,
initial focus, recovery, and opener restoration during intentional keyboard navigation. `useDialogFocus` registers a panel
with that owner; controller traversal uses the same active panel rather than portal
DOM order. One shared focus listener and mutation observer serve the stack and are
released when the last panel and pending restoration are gone.
Dialog focus containment belongs to the most recently opened interactive panel.
Opening the pause menu over a pending Wish suspends the Wish's focus trap;
closing the menu through a keyboard action restores focus to the choice. Escape clears focus instead. Inert and hidden panels do not reclaim focus. When a focused choice disappears or
becomes unavailable, focus recovers inside the active panel; removing a covered
panel preserves the foreground selection.
Confirmation focus containment pauses while the panel is inert; focus returns
to its existing target when the panel unmounts.

Use `focusableControls` from `shared/ui/dialogs/focus-navigation.ts` for traversal and
`isFocusAvailable` before programmatic focus. Recompute eligible controls when
handling input: a save, choice, pagination change, or rerender can disable or
replace a previously eligible button. Native disabled, hidden, detached, and
inert controls are unavailable; inspection-only `aria-disabled` controls remain
focusable. Do not maintain a second selector or cached traversal list in a dialog.

## Keyboard and Steam Input navigation

Steam Input uses the existing keyboard and pointer interfaces; there is no second
controller UI. The [mapping specification](./RELEASE_SETUP.md#mapping-specification)
is maintained with release setup. Bumpers traverse focus, Enter activates it,
Escape dismisses the top eligible layer. Arrow keys move focus to nearby visible
controls within the screen or top dialog. Left/right adjust horizontal sliders;
up/down leave them. Text editing and dropdowns keep their own arrow behavior.
Tab/Shift+Tab remain keyboard traversal; Steam Input uses F7/Tab for bumpers
to avoid the Steam overlay chord. Directional focus stops at layout edges.
Tab, F7, and arrow navigation enable focus navigation through the shared `focus-input.ts` owner. Enter and Space activate an already focused control; they never enable focus navigation themselves. Escape clears focus and cancels automatic handoffs, including screen recovery, dialog entry/restoration, and delayed artwork readiness. Pointer presses, mouse-wheel scrolling, and window blur disable automatic handoffs. Navigation key repeats cannot re-enable focus after dismissal or pointer input; release and press a navigation key again to resume. Keyboard focus uses a neutral warm gray outline.
Window switching (Alt+Tab or Command+Tab) does not traverse controls or arm deferred
focus recovery. Window blur cancels pending screen and hand focus recovery without
opening the game menu; existing focus stays in place on return. Steam overlay
activation still opens the battle pause menu.
The controlled select state registers above dialogs in the Escape stack so it
cannot accidentally navigate out of Options or Armory.

[Screen focus](../src/app/use-screen-focus.ts) recovers after intentional focus navigation across screen
readiness changes when the old focus is gone or unavailable. Pointer input cancels
that behavior. Ready, visible controls are selected through
[shared focus eligibility](../src/features/alchemy/shared/ui/dialogs/focus-navigation.ts);
inert, hidden, and natively disabled controls are excluded. Inspection-only
aria-disabled controls can still be traversed and inspected. Recovery scrolls
only as needed. Closing inspection does not trigger screen-focus recovery.
During focus navigation, dialogs restore their opener or fall back to the active screen when a previously
focused opener disappeared. Opening a dialog with no control focused restores
that unfocused state on close. Deferred restoration retains an opener through temporary screen preparation,
including when it stays inert beyond the first recovery frame. Fresh pointer input
or focus elsewhere cancels that pending restoration. Existing focus is respected when deferred recovery runs. Pointer-opened dialogs and pointer-selected results do not select a control automatically. Inventory search focuses its text field only when explicitly opened, not merely because a saved filter keeps it expanded.

Battle hand recovery is local to the hand and uses stable card identities. After a
keyboard play, focus goes to the next playable card in the prior visual order,
then a preceding playable card, then a newly drawn playable card, and finally End
Turn. Recovery waits for card transfer, activation animations, and player-turn readiness; Tab, Escape, or
pointer presses or mouse-wheel scrolling cancel pending hand recovery. Pointer plays do not move focus.
Card previews remain visible when the cursor leaves a keyboard-focused card.
Cards expose current play availability through aria-disabled while retaining
inspection. Existing battle commands remain the authority for accepting plays.

Held Enter/Space repeat events are consumed at the app boundary to prevent a held
confirm from activating successive cards or newly entered screens. Separate
presses still work normally. Held Escape repeats cannot dismiss further layers;
sliders retain arrow-key repeat behavior.
