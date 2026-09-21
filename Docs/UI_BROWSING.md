# Browsing and rewards UI

Shared conventions: [UI](./UI.md).

## Collection and Armory browsing

Collection and Armory browsing measure their available grid width and scaled
tile size. Page size is two rows times the resolved column count, capped at eight
portrait or six landscape columns. Resize retains the selected or first visible
item. Grid measurements retain available width and scale so switching between
portrait and landscape tabs resolves capacity before page synchronization.
Pagination shares its bounds and resize anchoring in `shared/ui/pagination.ts`;
`use-pagination.ts` owns local and parent-synchronized page transitions. Clamping
updates the retained page, so growing a list does not revive a removed page.
Armory context changes reset to the first page; Collection keeps per-tab page
memory. Parent page changes take precedence over resize anchoring. Collection
and card pickers report automatic corrections through their existing callbacks
after commit, once per correction, without notifying for acknowledged pages.
Empty lists use page zero with one logical page and a minimum capacity of one.
Offered choices remain content-owned, independent of browsing capacity.

Activating a Bestiary portrait keeps its attack sound and plays its registered boss
music when available, including for undiscovered entries. Music loops until the
Bestiary page or Collection tab changes, restoring menu music; leaving Collection
uses the destination screen's music. Another supported boss switches the track;
repeating the same boss does not restart it. Entries without a track leave music
unchanged. Playback uses the shared audio fades, volume, and background mute rules.
Outgoing screen content becomes inert as soon as navigation changes the active
screen and rejects activation events during its fade, so stale portrait activation
cannot replace destination music.

Collection entries rest with dim grey borders. All entries, including locked and
undiscovered entries, show a matching keyword Shine Border on hover or
keyboard focus, with neutral shine when no keywords resolve. Homestead companions
and upgrades use the same treatment regardless of affordability or discovery.
Wish and reward choices use the same hover treatment. Trinkets and gear, including
uniques, use their effect keywords on these surfaces, with neutral shine when none
exist. Shared trinket and gear art tiles, including Mystery rewards, shops, and
run-end items, also rest with the default border and show Shine only on hover or
keyboard focus. Their existing Shine palettes and item-title colors are preserved.

Hover-only Shine Borders and persistent Shine Borders render as a border only,
with no outer glow, including their existing focus activation. `ShineBorder`
owns the animated border; [component styles](../src/styles/components.css) own
its opacity and transition.
Wildcard uses the same static `ShineBorder` as every other hero. Keep the border
outside artwork clips. The border replaces the ordinary gold hover glow without
changing scale or press feedback. Selection alone retains its existing treatment.
Purely persistent decoration, turn indicators, and Death’s Door borders render
the same border-only treatment.
`ShineBorder` is decorative (`aria-hidden`) and positioned `absolute` with
`rounded-[inherit]`, so its parent must be `relative` with a rounded corner.
An empty palette falls back to neutral shine rather than rendering black.
`Progress` renders a bare progressbar: every call site must pass an accessible
name (`aria-label`/`aria-labelledby`), and `value` owns the fill width —
`fillStyle` carries only extra styling such as transitions.

## Card-removal browsing

Shop card removal reserves a fixed available-height card area between its header
and pagination/actions. It shows two rows when they fit and one otherwise, keeping
card size readable and the header and actions stationary across pages. Only the
card area scrolls if even one row cannot fit. The removal header replaces the shop
header, gold counter, and instruction text; the Remove action retains its gold cost.

## Rewards and Wishes

Wish uses the shared collection-choice card size, independent of battle-hand sizing.
All choices stay on one row and shrink evenly to fit, including four-card Wishes;
the card area scrolls when needed. Activating a card immediately resolves the Wish.
There is no selection, confirmation, or skip action; Escape and backdrop clicks do
not dismiss it. Each queued Wish accepts a fresh activation even when options repeat.

Reward cards and items are claimed immediately on activation. Only card rewards
retain Skip; there are no reward confirmation buttons. Claim-in-flight disables
choices and Skip until the next reward surface or destination is committed.
Reward choice cells share one flex centering and reserve one tile row across
card, gear, trinket, and boon, and the resource row and Skip footer reserve
their heights (with a spacer when Skip is unavailable) so back-to-back rewards
keep the same spacing.

## Options

Options opened from either end-run outcome returns to that same recap through Back or Escape, including after changing Game Size.

Game Size and Tooltip Size are device-local preferences, separate from game
saves and cloud mirroring. Reset Sizes and Reset Options reset both. Clearing
progress or importing a save does not change them.

Options centers a shared tab area sized by its tallest panel. Inactive panels
remain in the same grid cell, invisible and inert, so switching tabs preserves
the header and control positions. The page scrolls when the content exceeds the
available height.

## Armory crafting and salvage

Targeting cancellation treats icon descendants, including SVG paths, like their containing controls. Currency targeting survives clicks within the workspace and its recognized controls; salvage targeting survives clicks on salvageable items, the salvage toggle, and the crafting strip. Other clicks cancel targeting. Right-clicks on gear, Trinkets, equipment slots, and crafting currencies leave targeting active; other right-clicks cancel, suppressing the browser context menu only within the workspace. Escape, window blur, and hiding the document also cancel targeting. Activation clicks do not cancel the mode they enable, and cancellation listeners are active without a timer delay. Salvage confirmation owns its own dismissal while targeting listeners are suspended.

Currency artwork shares one 5rem size between the crafting strip, pointer attachment, and salvage preview. The pointer attachment is offset from the hit point, hides for touch and outside the workspace, and never intercepts input. Reward quantities are plain numbers; preview currencies are focusable information groups rather than action buttons.

Selecting an item for salvage immediately ends targeting and clears its cursor and highlights. Confirm, Cancel, and Escape return to browsing. The dialog uses the heading “Salvage,” a wrapping shining item name in “Salvaging [item] will yield:”, a portrait, full-size currency rewards, and an equipped-character warning where applicable. Confirmations focus Cancel, contain keyboard focus, and disable actions during exit.

Crafting consumes one currency per activation. Escape cancels targeting; invalid targets explain their restriction in tooltips and after selection. Success shows actual before/after affix descriptions in a dismissible panel pinned inside the viewport, a brief item pulse, and count feedback only when quantities change.

### Equipment movement animations

See [Equipment movement animations](./UI_MOTION.md#equipment-movement-animations).

## Run journey recap

Journey’s End focuses on earned rewards and progression, without a room trail or
Act/node summary. Deck and Boon inspection retain their normal labels and shared
overlay behavior. Victory keeps its own title.
