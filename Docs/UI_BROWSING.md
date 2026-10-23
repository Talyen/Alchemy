# Browsing and rewards UI

Shared conventions: [UI](./UI.md).

## Main Menu

Desktop pairs Quit on the bottom left with Options on the right. Quit uses a
rose-colored Power icon; browser Options stays centered. Demo completion uses
standard page gutters and [contains the complete marketing image](./STEAM_DEMO.md#marketing-presentation).

## Collection and Armory browsing

Collection and Homestead center real items in wrapping rows without fillers.
Reserve two rows and a pagination slot on every tab/page, keeping the complete
group centered and its header, tabs and pagination stationary. Center shorter
grids within that area; single-page tabs leave the pagination slot empty.

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

Activating a discovered Bestiary portrait plays its registered boss music when
available; undiscovered entries do not respond. It does not play an attack sound. Music loops until the
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

Shine Borders, neutral fallbacks and `Progress` semantics follow
[shared components](./UI.md#component-conventions). Collection and reward borders
keep their palette, scale and press feedback; selection retains its existing state.

## Shop prices

Prices use the shared [GoldCost](../src/features/alchemy/shared/ui/display-elements.tsx)
coin/amount treatment and muted unaffordable state. Over artwork they float directly
on the illustration with dark contour shadows, without containers or art fades;
inside buttons they inherit button typography.
[PurchasableShopTile](../src/features/alchemy/run-loop/shop/ui/purchasable-shop-tile.tsx)
owns the over-art placement and shadow recipe.

## Mystery reward shelves

Each Mystery choice shows its rewards above its action button. Keep the event art
at the standard landscape size, cards at the standard inspection size, and Boons
and Gear at the standard Collection size. Portrait rewards keep their 3:4 aspect
ratio; shelves wrap instead of reducing artwork sizes. Resource pills and XP stay
with their choice, including previewed Homestead bonuses. Reward boxes follow the
[balanced-row layout](#run-journey-recap).

Hover or keyboard focus inspects a reward without choosing the outcome. Only the
choice button commits the original offer. Known cards and Boons show their normal
effect tooltips. Generated Gear previews show the known item artwork and explain
that effects roll after choosing; random Gear and future card selections retain
their outcome labels instead of inventing a rolled reward.

## Homestead gallery

Homestead is an artwork-first gallery. Hover/focus inspects a node through the
ordinary passive `PortaledTooltip`, sharing Collection's scale, chrome, and
dismissal. Top-row tooltips always appear below; bottom-row tooltips always appear
above, with automatic flipping disabled even when their content changes size.
Tooltips contain no controls and receive no focus; Tab moves between gallery
controls. Clicking the artwork or pressing Enter/Space on it directly builds,
upgrades, or bonds the node.

Stars beside the name show purchased levels or bonds. Unbuilt nodes show
their name, empty stars, first-tier benefits, and purchase cost. Preview benefits
have partially muted text while retaining keyword hues; purchased benefits use full color.
Each effect row starts with one 20px icon aligned to its first line. Icons reuse
keyword shapes and colors, including damage-reduction effects; mixed effects use
their first authored keyword. Potion potency uses a round flask in Herbs green,
discounts use a Gold price tag, and Astral chance uses a wand in Gems blue.
Material bonuses use their first resource's artwork in the same leading slot,
with colored resource names in the text and no repeated artwork. Icons retain
their color in preview states.
Unbonded Companions show their name, empty stars, and bond cost.
Purchased nodes show current bonuses and Find 10/20/30/40% more resource quantities,
with uniform effect-row spacing and no section headers or next-tier comparisons.
Completed nodes show current benefits without costs; undiscovered Companions show
their discovery requirement. The wallet stays in the gallery, which has no upgrade
arrows or separate detail screens.

Build, Upgrade, or Bond costs appear as a plain row with material icons and
quantities. Build and Upgrade labels are one text size larger than the quantities.
Missing materials use red quantities without additional feedback text.
A divider separates purchased bonuses from the next cost. The artwork stays focusable for
inspection but cannot purchase when more materials are needed. A visible Saving
acknowledgment on the artwork precedes purchased artwork/progress and sound;
synchronous tier guards reject repeated input. Dismissing the tooltip or changing
tabs cannot cancel or repeat an accepted purchase. Errors appear only on failure
and remain visible outside the tooltip.

Reset Homestead uses the same circular-arrow header action and neutral
confirmation as Reset Talents, immediately before the menu button. It resets
Buildings, Farm, Research, and Companion bonds and refunds purchased tier costs
to the stockpile, preserving discoveries. Empty Homesteads and pending mutations
disable reset. Confirmation closes after acceptance; the reset display waits for
save acknowledgment, using shared Saving/Retry feedback. The current tab/page
stays selected and cleared tiers can be purchased again.

Homestead artwork keeps its native aspect ratio without cropping. Landscape
nodes retain the larger Homestead-specific width and the
[shared two-row reservation](#collection-and-armory-browsing). Artwork uses the shared
hover/focus outline and scale with `card-interactive-no-glow`. Affordable
nodes add only a tight, static outer gold halo at rest, retaining the neutral
border until hover/focus, without pulse, shimmer, or shine. Affordability updates
after spending and is suppressed while a purchase is saving. Nodes stay grayscale
until their first purchase, then remain colored even when the next purchase is
unaffordable. Undiscovered Companions remain grayscale.

### Purchase motion

Homestead purchases retain the old node while saving. Once acknowledged progress
is available, tooltip sentences and icons remain steady. Changed values reveal
with a slight rise; there is no whole-body fade or delayed swap.
New/removed rows ease panel height with the same transition. The name stays mounted and the
edge nearest the node stays anchored; passive tooltips retain their fixed row side.
The tooltip celebrates acknowledged purchases with a scale bounce, originating at the edge nearest the artwork. It never
remounts the content or replays on hover; dismissal or a newer purchase cancels
its animation. The earned star pops with a soft gold highlight. First
builds/bonds crossfade opacity layers into color without animating
grayscale filters; later upgrades/bonds pulse an independent gold edge glow. There are no Built/Upgraded/Bonded labels over the artwork.
Exact durations live in [`HOMESTEAD_FEEDBACK`](../src/lib/game-constants/ui-motion.ts);
bounce geometry belongs to [node artwork](../src/features/alchemy/meta/screens/homestead/node-artwork.tsx)
and [component styles](../src/styles/components.css).

Feedback tokens belong to accepted purchases, never hydrated levels. Repeated
valid purchases replace visual targets without waiting for motion. Tooltip
dismissal settles content; tab/page changes, navigation, and reset cancel local
animation without cancelling committed purchases. Existing unlock/bond sound
plays once after acknowledged progress is available. Reduced/disabled motion
updates values and filled stars immediately without decorative animation. Reset uses the
standard confirmation/save feedback without a purchase celebration.

## Card-removal browsing

Shop card removal uses a centered, content-scaled maximum height and standard page
gutters. Its fixed available-height card area sits between the header and
pagination/actions; short windows shrink that area, while tall windows keep the
footer with the content. It shows two rows when they fit and one otherwise, keeping
card size readable and the header and actions stationary across pages. Only the
card area scrolls if even one row cannot fit. The removal header replaces the shop
header, gold counter, and instruction text; the Remove action retains its gold cost.

## Campaign destinations and Campfire

Before choosing at Campfire, a heart in the Health keyword color and the actual
recovery amount appear below Rest, including zero at full Health. Campaign
destination headers say Choose Destination without an act indicator. The named
boss entrance keeps its existing title; reward screens say Victory.

### Campfire and Transmutation

[Brewing rules](./GAME_RULES.md#brewing-transmutation-and-elemental-reactions)
determine the available service. Campfire mixing lets the player choose two
eligible instances, inspect the preview and Confirm Mix. With fewer than two,
activating one of the three fixed offers grants it immediately. Screen and command
enforce the same choice. Alchemist shows Mix Potion and Distill as separate services.

Transmutation previews the selected source's first compatible keyword immediately.
Up to three keyword buttons above the original-to-preview comparison select saved
alterations. Back returns to the card picker without RNG or deck changes. Transmute
commits the validated preview. After a covering save, show its inspectable result,
play the card-reward chime once and wait for Continue. Pending/failed saves lock
choices under [Saving/Retry feedback](./UI.md#pending-saves-and-action-feedback).
Completed resume shows the saved result and Continue without another alteration or
chime. Continue never regrants the card. Visits with no valid alteration, or a
completed visit missing its result, advance after offer initialization.

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

Display groups Display Mode (desktop only), Brightness, Game Size and Tooltip
Size. Background groups Background Glow and Background Particles.

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
available height. Error Log scroll caps use stage units.

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

Talents on the end-run screen and Mystery rewards use fixed-width boxes in centered,
balanced rows. Use the fewest rows that fit, up to five boxes per row, with larger
rows first and counts differing by at most one. Recalculate for available width
or Game Size changes.

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
