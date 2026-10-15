# Browsing and rewards UI

Shared conventions: [UI](./UI.md).

## Collection and Armory browsing

### Boards

The Boards tab uses a fixed three-column, two-row gallery with six entries per
page at every window width. Tiles grow to fill the shared Collection shell width,
shrinking together in narrower windows, and preserve the artwork's aspect ratio.
It reserves the same two portrait rows and pagination slot as every Collection
tab, keeping headers, tabs, and pagination stationary. Partial pages center real
entries without fillers. The Boards tab uses a Wallpaper icon with a warm brown
accent.

None and Random are the first two paginated entries, with their names centered
inside the artwork area; activating either selects it immediately. Random picks
only collected boards. Art tiles have no captions or collected count. The active
choice has no persistent selection border; accessible current state remains.
Tiles use Collection's 103.5% hover/focus scale and standard 3px gold Shine Border,
reserving the 1px frame so interaction cannot shift the layout. Board names and
locked state remain in accessible control names; a lock indicator sits inside
locked artwork. Locked art stays grayscale until hover/focus.

Inspection fills the game area with full-color artwork, using the same independent
width/height scaling as battle boards. Use Board sits centered in the lower third
for owned boards, including the currently equipped board. Successful selection
closes the preview; a rejected selection keeps it open. Locked previews show the
five-room reward requirement in that position. The top-right close control and
Escape dismiss the preview and restore focus to the originating tile.

Options → Display → Browse Boards opens this tab;
Back returns to Options while preserving its original return target.

A collected board is revealed after the run recap and hero reveals, before demo
completion or Main Menu. Use Board equips it and continues; Continue preserves
selection. Unacknowledged reveals recover at Main Menu after restart. Ownership
commits during settlement, independently of the reveal.

Battle boards use a centered 16:9 surface that covers the game stage. Artwork
keeps its proportions; excess edges crop to fit wider or taller viewports without
stretching or internal margins. Stage layering is
board art, existing background plasma glow, battle particles, then combat UI.
Existing glow/particle settings remain effective. The shared
[tabletop treatment](./UI_BATTLE.md#shared-tabletop-appearance) derives ambient
tint from the board thumbnail; boards require no authored lighting metadata.

Collection measures available grid width and scaled tile size. Page size is two
rows times the resolved column count, capped at four columns for Heroes, Cards,
Trinkets, and Uniques, or three for Bestiary. Resize retains the selected or first visible item; switching artwork
orientation resolves capacity before page synchronization. Collection keeps
per-tab page memory.

`meta/screens/collection/collection-items.ts` owns each tab's ordered catalog,
default capacity, and undiscovered copy. All tabs share pagination and discovery
masking. Tile payloads are discriminated by `frameType`; catalog data stays
available for locked-entry shine, while discovery gates tooltip details.

Armory uses six-item pages and retains working order and page per hero and slot
while mounted. Its inventory-header Search, Filters, and Sort controls keep criteria
per hero/slot. Filtering preserves hidden items in the complete working order;
criteria changes and one-time sorting reset that category to page zero; equipment movement
preserves positions according to [Armory ordering](./ARMORY.md#inventory-ordering-and-equipment-movement).
Do not apply Collection's adaptive page-size policy to this inventory.

Shared pagination bounds live in `shared/ui/pagination.ts`; `use-pagination.ts`
owns local and parent-synchronized transitions. Parent page changes take
precedence over resize anchoring. Collection and card pickers report automatic
corrections through their callbacks after commit, once per correction. Empty
lists use page zero with one logical page and a minimum capacity of one.
Offered choices remain content-owned, independent of browsing capacity.

Activating a Bestiary portrait plays its registered boss music when available,
including for undiscovered entries; it does not play an attack sound. Music loops until the
Bestiary page or Collection tab changes, restoring menu music; leaving Collection
uses the destination screen's music. Another supported boss switches the track;
repeating the same boss does not restart it. Entries without a track leave music
unchanged. Playback uses the shared audio fades, volume, and background mute rules.
Outgoing screen content becomes inert as soon as navigation changes the active
screen and rejects activation events during its fade, so stale portrait activation
cannot replace destination music.

Collection entries rest with dim grey borders. All entries, including locked and
undiscovered entries, show a matching keyword Shine Border on hover or
keyboard focus, with neutral shine when no keywords resolve. Wish and reward
choices use the same hover treatment. Homestead companions and upgrades follow
their separate [gallery treatment](#homestead-gallery).
Trinkets and gear, including uniques, use their effect keywords on these surfaces,
with neutral shine when none
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

## Homestead gallery

Homestead is an artwork-first gallery. Hover/focus inspects a node through the
ordinary passive `PortaledTooltip`, sharing Collection's scale, chrome, and
dismissal. Top-row tooltips always appear below; bottom-row tooltips always appear
above, with automatic flipping disabled even when their content changes size.
Tooltips contain no controls and receive no focus; Tab moves between gallery
controls. Clicking the artwork or pressing Enter/Space on it directly builds,
upgrades, or bonds the node.

Stars beside the name show purchased levels or bonds. Unbuilt/unbonded nodes show
only their name, empty stars, and purchase cost, without first-tier previews.
Purchased nodes show current bonuses and Find 10/20/30/40% more resource quantities,
with uniform effect-row spacing and no section headers or next-tier comparisons.
Completed nodes show current benefits without costs; undiscovered Companions show
their discovery requirement. The wallet stays in the gallery, which has no upgrade
arrows or separate detail screens.

Build, Upgrade, or Bond costs appear as a plain row with material icons and
quantities. Missing materials use red quantities without additional feedback text.
A divider separates purchased bonuses from the next cost. Gold uses the same
inline icon chip as Homestead materials. The artwork stays focusable for
inspection but cannot purchase when more materials are needed. A visible Saving
acknowledgment on the artwork precedes purchased artwork/progress and sound;
synchronous tier guards reject repeated input. Dismissing the tooltip or changing
tabs cannot cancel or repeat an accepted purchase. Errors appear only on failure
and remain visible outside the tooltip.

Purchase feedback and reduced-motion behavior follow
[Homestead purchase motion](./UI_MOTION.md#homestead-purchases). Feedback belongs
to the accepted purchase and never replays from hydrated levels.

Reset Homestead uses the same circular-arrow header action and neutral
confirmation as Reset Talents, immediately before the menu button. It resets
Buildings, Farm, Research, and Companion bonds and refunds purchased tier costs
to the stockpile, preserving discoveries. Empty Homesteads and pending mutations
disable reset. Confirmation closes after acceptance; the reset display waits for
save acknowledgment, using shared Saving/Retry feedback. The current tab/page
stays selected and cleared tiers can be purchased again.

Homestead artwork keeps its native aspect ratio without cropping. Landscape
nodes retain the larger Homestead-specific width and fixed two-row geometry,
keeping headers, tabs, and pagination stationary. Artwork uses the shared 3px
hover/focus outline and 103.5% scale with `card-interactive-no-glow`. Affordable
nodes add only a tight, static outer gold halo at rest, retaining the neutral
border until hover/focus, without pulse, shimmer, or shine. Affordability updates
after spending and is suppressed while a purchase is saving. Nodes stay grayscale
until their first purchase, then remain colored even when the next purchase is
unaffordable. Undiscovered Companions remain grayscale.

## Card-removal browsing

Shop card removal reserves a fixed available-height card area between its header
and pagination/actions. It shows two rows when they fit and one otherwise, keeping
card size readable and the header and actions stationary across pages. Only the
card area scrolls if even one row cannot fit. The removal header replaces the shop
header, gold counter, and instruction text; the Remove action retains its gold cost.

## Campaign destinations and Campfire

Before choosing at Campfire, Rest shows a red heart and the actual recovery
amount, including zero at full Health. Campaign destination headers show the
upcoming choice as Act 1-1, Act 1-2, and so on; each act restarts its room count.
The named boss entrance keeps its existing title.

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

Gameplay Options contains Auto-End Turn and Remember Auto-Battle Preference. The former Controls instructions are removed. Failed local saves show the shared non-modal warning and Retry action; progression waits for local acknowledgement under [pending saves and action feedback](./UI.md#pending-saves-and-action-feedback).

Options opened from either end-run outcome returns to that same recap through Back or Escape, including after changing Game Size.

Game Size and Tooltip Size are device-local preferences, separate from game
saves and cloud mirroring. Reset to Default in the Other tab resets options and both sizes. Clearing
progress or importing a save does not change them.

Options uses compact unboxed groups with pale-gold headings, fading rules,
neutral row dividers, inline controls, and
fixed-width slider percentages. Slider and dropdown rows stack below 36
content-scaled rem of panel width. Options centers a shared tab area sized by its tallest panel. Inactive panels
remain in the same grid cell, invisible and inert, so switching tabs preserves
the header and control positions. The page scrolls when the content exceeds the
available height.

## Armory crafting and salvage

Targeting cancellation treats icon descendants, including SVG paths, like their containing controls. Currency targeting survives clicks within the workspace and its recognized controls; salvage targeting survives clicks on salvageable items, the salvage toggle, and the crafting strip. Other clicks cancel targeting. Right-clicks on gear, Trinkets, equipment slots, and crafting currencies leave targeting active; other right-clicks cancel, suppressing the browser context menu only within the workspace. Escape, window blur, and hiding the document also cancel targeting. Activation clicks do not cancel the mode they enable, and cancellation listeners are active without a timer delay. Salvage confirmation owns its own dismissal while targeting listeners are suspended.

Focusing the Armory browsing controls clears crafting/salvage targeting. Search
expands inline; Close or Escape clears it and returns focus to Search. Filters
and Sort open panels below their buttons, bounded within the inventory panel.
Both dismiss on Escape, outside clicks, or keyboard focus leaving their controls.
Escape closes the panel before navigating away and returns focus to its opener.
Filters apply immediately, remain open during selections, and highlight the
Filters icon while criteria are active; Sort closes after a choice. There are no
criteria chips or visible match counts. Empty filtered results explain that no
items match; ordering and sort choices follow [Armory ordering](./ARMORY.md#inventory-ordering-and-equipment-movement).

Crafting-strip, reward, and salvage-preview currency artwork uses 5 content rem so it follows Game Size. The floating pointer attachment keeps its 5 CSS rem cursor footprint; it is offset from the hit point, hides for touch and outside the workspace, and never intercepts input. Reward quantities are plain numbers; preview currencies are focusable information groups rather than action buttons.

Selecting an item for salvage immediately ends targeting and clears its cursor and highlights. Confirm, Cancel, and Escape return to browsing. The dialog uses the heading “Salvage,” a wrapping shining item name in “Salvaging [item] will yield:”, a portrait, full-size currency rewards, and an equipped-character warning where applicable. Confirmations focus Cancel, contain keyboard focus, and disable actions during exit.

Crafting consumes one currency per activation. Escape cancels targeting; invalid targets explain their restriction in tooltips and after selection. Success shows actual before/after affix descriptions in a dismissible panel pinned inside the viewport, a brief item pulse, and count feedback only when quantities change.

## Run journey recap

Journey’s End focuses on earned rewards and progression, without a room trail or
Act/node summary. Deck and Boon inspection retain their normal labels and shared
overlay behavior. Victory keeps its own title.

When a run newly unlocks a hero, Continue opens a Hero Unlocked reveal with that
hero’s portrait and name before Main Menu. Hovering or focusing the portrait
shows the same hero tooltip as hero selection, including the starting deck and
keywords. The reveal tooltip prefers below the portrait. Hero selection uses a
consistent placement per row: below the top row and above the bottom row,
regardless of whether a hero is locked. Shared
collision handling keeps tooltips within the game frame. The background glow
uses that hero’s selection palette. Repeat runs do not replay unlocks.
Defeat and manual End Run follow the same unlock rules as victory. Demo victories
show available hero unlocks before the demo completion screen. Unlock reveals,
like the recap, are transient; permanent hero availability remains saved.
