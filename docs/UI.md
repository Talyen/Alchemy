# UI system

Canonical owner for UI placement, primitives, interaction, motion, tooltips, and
Alchemy's accessibility stance. Screen wiring checklists remain in
[WORKFLOWS.md](./WORKFLOWS.md#adding-a-new-screen). Armory interaction lives
[below](#armory-crafting-and-salvage); Gear data and mutation rules live in
[ARMORY.md](./ARMORY.md).

## Placement and boundaries

- `src/components/ui/` owns generic Tailwind/Radix primitives with no game-domain knowledge. These components receive domain data through props and do not import `@/features` or subscribe to gameplay stores.
- `src/features/alchemy/shared/ui/` owns reusable game widgets such as cards, choice buttons, status icons, actor panels, shop slots, and map nodes. They receive run, battle, and session data through props. Presentation-only `ui-store` state is allowed.
- Screens and feature-local presentation stay with their owning feature until at least two feature domains need the same widget.
- Static catalogs used by shared game widgets come from `shared/config/game-data-catalog.ts`, not the token `config/` barrel.

Use `ScreenShell`, `TitledScreenShell`, `ScreenHeader`, and `PageLayout` for page structure. Use shared chrome before recreating buttons, progress bars, switches, cards, or tooltips.

For flow-specific rules, use [display sizing](#display-sizing), [Collection and Armory browsing](#collection-and-armory-browsing), [card removal](#card-removal-browsing), [rewards and Wishes](#rewards-and-wishes), or [Options](#options).

## Component conventions

- Use plain prop functions rather than `React.FC`; React 19 components receive `ref` directly as a prop.
- When a hook returns callback refs alongside layout values, destructure them before JSX so React Compiler can distinguish callbacks from ref objects.
- Use `cn()` for conditional classes and existing CVA variants for semantic states.
- Generic interactive primitives preserve standard ARIA roles, names, values, keyboard behavior, and disabled states. Eligible talent nodes use native buttons for Enter and Space; keyword trees without portrait art remain selectable using a blank portrait and the keyword icon.
- `Surface` is the shared interactive card/tile owner (`onClick` works for both `button` and `div` renderings; prefer `as="button"` for actions). `PortaledTooltip` with `TooltipPanel` owns tooltip chrome. `ShineText` with `GearItemTitle`/`TrinketItemTitle` (both in `gear-item-title.tsx`) own keyword/item shine typography.
- Astral gear and Trinket title shine uses at most three described keywords, each with its primary color and a 55%-opacity stop. Gear prefers matching base affinities; Trinkets retain description order. Unique gear titles stay gold. Artwork and border palettes remain independent.
- Over-art price chips use an opaque dark scrim with light text and shadow so card art cannot wash them out; affordable shop prices keep gold border and text on that scrim.
- `TraitBox` owns Trait containers, colored icons, keyword descriptions, and title shine across Labyrinth map details and enemy hover/inspection. Encounter icon themes live in shared configuration and also drive map effects. Enemy Traits and encounter modifiers form one deduplicated list; inspection uses two equal columns at 40rem of available content width, with a single-column fallback and full-width sole Traits. Hover and map Traits stay stacked. Apply inline-size containment only to the inspection layout: shrink-to-fit tooltips need their contents to contribute intrinsic width.
- Modal interaction and dismissal follow [Overlay lifecycle](#overlay-lifecycle).

## Overlay lifecycle

Modals and panels use `useModalEscapeDismiss` or `useCaptureEscapeCancel` so the global Escape stack remains ordered.

`ModalOverlayShell` portals into the app's shared modal host, outside the scaled
battle stage, inheriting the frame's content scale. Its fixed backdrop covers the
viewport regardless of where the modal is opened. Backdrop dismissal only handles
clicks on the backdrop itself; clicks inside content do not dismiss it or activate
underlying screen handlers. Required choices such as Wish remain non-dismissible.
Panels size to their contents with bounded width and height and scroll overflow;
card inspection retains adaptive pagination without reserving an empty full-screen panel.

Draw Pile, Discard Pile, and Deck inspection share the existing 180ms backdrop fade
with a 6px upward panel settle on opening, easing out over the same duration. Closing
uses only the fade; reduced motion omits the settle. Cards appear together, and
populated panels retain content-based sizing without animated dimensions. Empty
collections show centered, muted “Empty” text in a 10rem-high content area with a
20rem minimum panel width, bounded by the available viewport with overflow scrolling.

`ModalOverlayShell` owns overlay interaction eligibility: only open, rendered
content accepts input or registers an Escape handler. Closing content remains
visible for its existing fade but is inert and rejects activation events;
`mount=false` removes it immediately without retaining an Escape handler.
Reopening cancels pending removal. Consumers retain action-specific guards such
as Wish's single-selection latch and confirmation buttons' disabled state.
Confirmation focus containment pauses while the panel is inert; focus returns
to its existing target when the panel unmounts.

## Screen fade motion

| Concern            | Contract                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route change       | `useRenderedScreenTransition` owns the opacity-only page fade. Autosave, audio, battle playback, and presentation teardown follow committed `screen`, not `renderedScreen`.                                                     |
| In-screen identity | Use `FadeSlot` for tabs, shop modes, offerings, keyword trees, and other identity swaps. Its first mount is idle so it does not stack on the route fade.                                                                        |
| Overlays           | Dialogs, wish, and the game menu use `useFadePresence` so exit completes before unmount.                                                                                                                                        |
| Copy               | `ScreenDescription` is static. `TextAnimate` is reserved for mystery narrative.                                                                                                                                                 |
| Anti-flash         | Replace outgoing payloads only at the rendered-screen commit, swap layout while opacity is zero, reserve height for shape-changing swaps, and keep shell chrome mounted when payload data clears. Do not stagger route content. |

Screen and `FadeSlot` reveals wait for the mounted images to load and decode through `useArtworkReady`, then allow a layout frame before starting the fade. While preparing a reveal, the gate also tracks artwork inserted after layout measurement and changed image sources; stale decode completions cannot reveal or hide the replacement. The observer disconnects after reveal, so normal battle updates do not restart the whole-screen gate. Startup preloading is a warm-up, not proof that a later mounted image is paint-ready. Failed or timed-out images stay hidden for that mount so they cannot pop in after the screen is revealed. Reserve intrinsic artwork dimensions when image height determines layout, including the menu logo.

`FadeSlot` keeps outgoing and artwork-pending content inert. Identity-dependent
headings, prompts, resources, and actions must travel with their content: Victory
reward prompts/Skip share the reward-kind-and-choice identity, and Mystery titles
share the event-and-phase identity. Do not animate `filter` on artwork whose
state uses grayscale; reveal opacity must settle to the underlying state opacity
rather than force completed art to full color or full opacity.

`useHeldWhile` snapshots its input in an effect. Memoize composite inputs before passing them to the hook; fresh objects can trigger repeated rendering in environments without React Compiler.

Motion tokens live in `src/lib/game-constants/ui-motion.ts` (`MOTION_FADE_MS`, `TOOLTIP_FADE_MS`) and are mirrored to CSS as `var(--motion-fade-duration)` and `var(--tooltip-exit-duration)` in `src/styles/theme.css` / `src/styles/components.css`. Keep each JS duration and its CSS counterpart in sync; `npm run lint:architecture-smoke` asserts this.

Campfire snapshots the starting and restored Health when Rest is pressed. Its number
and bar share a 1.2-second eased refill, then hold the exact result for 800 ms before
continuing. Keep that snapshot through the outgoing screen fade so applying the heal
cannot restart the visible refill. Timing lives in `src/lib/game-constants/battle-timing.ts`.

## Buttons and interactive surfaces

Game-specific button shape and layout tokens live in `src/features/alchemy/shared/config/button-tokens.ts`. Primitive hover constants live in `src/lib/game-constants/ui-motion.ts` and are imported through the game-constants barrel.

`Button` always renders a native button. `wrapperClassName` optionally adds a layout span; `className`, refs, event handlers, and native button attributes belong to the button itself. Omitted `type` retains native form behavior.

| Concern        | Standard                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape          | `rounded-xl` rectangles through `BUTTON_SHAPE`                                                                                                                                                                                                                           |
| Primary        | `Button variant="primary"` for Play, Continue, and Confirm                                                                                                                                                                                                               |
| Secondary      | `Button variant="outline"` for Back, Cancel, Skip, and alternate navigation                                                                                                                                                                                              |
| Accent         | `ShineAccentButton` only for accent-intent forward actions                                                                                                                                                                                                               |
| Paired actions | Secondary left and primary right; shared button width tokens                                                                                                                                                                                                             |
| Equal choices  | `DestinationChoices` and `Surface`, with an accessible tile name                                                                                                                                                                                                         |
| Tabs           | `TabBar`                                                                                                                                                                                                                                                                 |
| Chrome icons   | `ChromeIconButton` owns header and battle-corner icon buttons (back, deck, menu, autoplay, boons): ghost `h-11 w-11` dim `text-muted-foreground/60` with `hover:bg-muted/40 hover:text-foreground`; active uses `bg-muted/40 text-foreground`, toggle-on uses `primary`. |
| Hover / press  | Primary buttons use CSS bloom without scaling; secondary buttons use background feedback. Preserve surface-specific CSS scaling and shared `active:` feedback; do not add parallel Motion hover scaling.                                                                 |

Card and collection artwork, including gear and trinket tiles, reserves a 1px frame across available, selected, disabled, purchased, and shine states, so changing interaction state cannot resize its artwork or row or recenter the screen. The thicker hover and selection outline is an absolute overlay, preserving the thin default border. Hover-only shine uses `card-art-shine`; persistent shine uses `has-shine-border`. Both hide the frame color while preserving its space. Pass frame Shine through `Surface.overlay` so the artwork clipping layer cannot hide it.

Artwork surfaces resolve their clipping radius from the same inline theme token and local content scale as the outer frame. The artwork radius subtracts the frame width so portrait and landscape corners meet in resting, hovered, and selected states.

Labyrinth's rectangular art nodes reuse `Surface`, shared shimmer, and Shine Border. Hover, keyboard focus, and selection enlarge only the emphasized tile to 106%; unknown tiles stay neutral. Completed art remains subdued. Reduced motion makes emphasis immediate and shine static. See [Labyrinth map](#labyrinth-map) for discovery and movement.

## Display sizing

Talents on the end-run screen and Mystery rewards keep fixed-width boxes in centered, balanced rows. Use the fewest rows that fit (up to five boxes per row), distribute counts with at most one box of difference, and place larger rows first. Recalculate when available width or Game Size changes.

The virtual stage owns available-space geometry and battle coordinates. Its fit
scale is not capped; content growth is. At fit scale `s <= 1`, content follows
`s`. Above that, automatic content scale is `min(1.75, s ** 0.8)`, multiplied by
Game Size (80–120%, 5% steps). Use CSS viewport dimensions, never device pixel
ratio, for layout. The root font remains 16px.

The stage's `--content-scale` is visible content scale divided by stage scale.
Inline Tailwind theme tokens and `--content-rem` size text, controls, cards,
spacing, and panels once. Percentage anchors and layout regions follow the
stage. Authored arbitrary content dimensions must use the content unit; do not
use raw container-height units as the primary card size. Available-space caps
are allowed: the battle hand caps card height, compresses its fan into the
reserved center region, and reserves extra bottom space for larger hands.
The battle bottom bar reserves content-sized side controls and gives the hand
the remaining width. Side controls stay stationary as the hand grows to seven
cards; smaller hands remain centered with capped spacing. Hand hover and pointer
activation use the nearest stable slot center, with boundaries halfway between
centers, independent of raised artwork and reflow motion. Hidden transfer cards
cannot receive pointer selection. Keyboard focus uses the native card buttons.
Enlarged actors shift upward to keep health and battle controls clear. Backgrounds
fill the frame.

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
undiscovered entries, show matching keyword Shine Border and glow on hover or
keyboard focus, with neutral shine when no keywords resolve. Homestead companions
and upgrades use the same treatment regardless of affordability or discovery.
Wish and reward choices use the same hover treatment. Trinkets and gear, including
uniques, use their effect keywords on these surfaces, with neutral shine when none
exist. Shared trinket and gear art tiles, including Mystery rewards, shops, and
run-end items, also rest with the default border and show Shine only on hover or
keyboard focus. Their existing Shine palettes and item-title colors are preserved.

Hover-only Shine Borders and persistent Shine Borders that strengthen on hover pair
with the shared keyword glow, including their existing focus activation. `ShineBorder`
owns the optional `glow` treatment: zero offset, 16px blur, 45% opacity, and a 200ms
transition, tinted with the palette's first color. Wildcard glow follows its cycling
color. The outer layer casts the glow around the masked inner border; keep it outside
artwork clips. Paired glow replaces the ordinary gold hover glow without changing
scale or press feedback. Selection alone retains its existing treatment. Purely
persistent decoration, turn indicators, and Death’s Door borders do not opt in.

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

## Options

Options opened from either end-run outcome returns to that same recap through Back or Escape, including after changing Game Size.

Game Size and Tooltip Size are device-local preferences, separate from game
saves and cloud mirroring. Reset Sizes and Reset Options reset both. Clearing
progress or importing a save does not change them.

Options centers a shared tab area sized by its tallest panel. Inactive panels
remain in the same grid cell, invisible and inert, so switching tabs preserves
the header and control positions. The page scrolls when the content exceeds the
available height.

## Labyrinth map

The complete twenty-room floor fits below the stationary Labyrinth header in
rows of 4 / 6 / 6 / 4. There is no Floor N subheader; the floor number is the
Entrance inspector's eyebrow and the map region's accessible description.
Equal 4:3 full-bleed art tiles maximize their size against both available
dimensions, with narrow gutters and room for 106% hover enlargement. Positions
stay fixed during discovery, selection, and destination return. There is no
scrolling, zoom toolbar, legend, corridor, visible room label, or location dot.

Undiscovered rooms contain only a neutral `?`; no hidden art, category, Trait,
accessible name, or hover theme is exposed. Actual Mystery encounters reveal
their existing art. The boss is always visible and inspectable, with the shared
display label Boss and a persistent red glow independent of hover/selection.
All rooms rest with the standard dim `border-border/80` frame, except the current
room's shared `border-primary` amber. Reachability does not change border color.
Shared hover, focus, and selection keep shimmer and Shine Border; unknown
interactions stay neutral. Completed art remains grayscale and subdued from
its first frame, including during the opacity reveal and route returns.

Clicking or keyboard-activating a discovered room opens its inspector. An
unfinished room offers its action when adjacent to any completed room; there
is no explicit walking action or backtracking requirement. Inspection never
changes completion or location. Current location remains accessible through
`aria-current="location"`. Reduced motion freezes emphasis and shine.

One inspector floats beside the selected tile without reserving a sidebar or
resizing the grid. It prefers right, then left, top, or bottom, with a 10px gap
and 8px boundary padding. Its width is 320–420 rendered pixels, capped to the
viewport; width and node-gap limits compensate for virtual-stage scale.
Outside clicks dismiss it, another inspectable node switches inspection, and
Escape dismisses and restores focus. Floor changes dismiss old selection.

The inspector retains natural-aspect artwork, the category/name overlay, shared
Trait containers, and a pinned action footer while details scroll. Inaccessible
rooms omit the action footer and adjacency instructions. A completed boss offers
Descend regardless of the last completed location, reporting rooms left behind.
Combat, services, and rewards retain their existing actions.

## Corrupted card text

Corrupted card titles retain the animated red-and-white shine on the “Corrupted” prefix only. Corrupted numerical values use solid `text-destructive` dark red with no animation. Keywords retain their normal colors, including added Leech and Consume; removed Consume disappears without a placeholder. The altar uses the existing card picker and before/after result, with no extra outcome choices or previews.

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
Tooltip Size also multiplies that baseline. Enemy tooltips prefer 28rem of width
at the independent tooltip scale to give boxed Trait descriptions room to wrap. Placement recomputes width bounds when the stage or tooltip changes
size; position-only updates preserve the resolved width to avoid forced layout. Long
descriptions can use available width to fit; tooltips never scroll or truncate.

- Drive ordinary hover with `useHoverVisible()` and `triggerRef`. For card/tile grids that already track hover via `useInteractiveCard`, use `useTileHoverPopup` (a `useHoverVisible` preset with the shared `TOOLTIP_FADE_MS` hold) — see those hooks for the exact call shape.
- Use `placement="side-start"` or `"side-end"` for explicitly side-anchored panels.
- Use `maxWidthFraction` for small-window bounds.
- Tooltip entrance uses a 180 ms ease-out fade with 4 px of movement away from the trigger; exit uses a 120 ms fade with 2 px of return movement. CSS `@starting-style` supplies the first-render entrance, and transitions reverse smoothly on re-hover. Hover remains immediate for rapid inspection. Keep `--tooltip-exit-duration` in sync with `TOOLTIP_FADE_MS`.
- Tooltip panels are `pointer-events-none`; nested interactive tooltips are unsupported.
- `PortaledTooltip` retains the complete last visible content through fade-out, including descriptions computed only while hovered. Header and body enter and exit as one panel.
- State-driven triggers mount the portal only while hovered; exit fades complete via the shared `TOOLTIP_FADE_MS` hold — do not add a second hold alongside `PortaledTooltip`.
- Fade primitives are consolidated in `src/features/alchemy/shared/ui/use-fade.tsx` (import `FadeSlot`, `useFadePresence`, `useSequentialFadeSwap`, `useHeldWhile` from there directly); placement helpers live in `portaled-tooltip-placement.ts`, content slots in `tooltip-panel.tsx`. `DisabledTooltip` lives in `disabled-tooltip.tsx`.

## Accessibility stance

Alchemy is visual-heavy and intentionally ships no dedicated accessibility
feature set beyond semantic robustness. Preserve semantic buttons,
programmatic names and states, keyboard behavior supplied by shared primitives,
and `aria-hidden` on decorative art. Do not add focus traps/restoration,
screen-reader announcement systems, contrast tooling, or per-component
reduced-motion variants without a product decision. Preserve the existing
Armory confirmation focus behavior and reduced-motion handling documented
[below](#armory-crafting-and-salvage). Shared motion accommodations live in
`src/styles/keyframes.css` and `src/styles/components.css`; Armory also disables
inventory movement and crafting feedback motion locally.

## Battle motion

Battle VFX (lunge, shake, ghost layers, combat-text rails) is owned by
`run-loop/battle` + `run-loop/battle/presentation`. Guidance lives in
[WORKFLOWS.md](./WORKFLOWS.md#change-battle-playback); this file owns only the
shared widget/motion primitives above.

## Deck and pile inspection

The stacked-cards icon opens the run Deck during drafting,
run screens, and meta detours from that run. Drafting exposes picks so far through
the icon; it does not add a previous-picks strip. The icon has no tooltip. Draw
and Discard piles have keyboard-accessible inspection actions without visible
counters; counts remain in accessible action names.
Titled screen headers place Deck on the left alongside any Back control and Menu
on the right, with the title centered between them.

`CardInspectionOverlay` is controlled by props and reuses the modal shell,
`useDialogFocus`, card presentation, and adaptive pagination. Each copy remains
visible individually, sorted by displayed title with an instance-content tie
break independent of draw order. The grid uses `viewCardWidthClass`, matching
`CardSelectionGrid`’s 230.472 px reference width; larger Collection tiles do not
fit that measurement. The viewer shows only a centered collection title, cards,
and an upper-right close button, plus pagination controls when needed. It has no
collection tabs, counts, instructional or empty-state text, or labels below cards.
Open each collection from its own opener. Pagination resets on reopening.
Full Deck is the run deck, including cards Consumed in the current battle;
battle-only generated cards appear in their current piles instead. Deck, Draw
Pile, and Discard Pile cards show their keyword Shine Border on hover or
keyboard focus, with neutral shine when no keywords resolve, matching
Collection, Wish, and reward choices.

Inspection opens only between actions on a surviving player’s turn, with no
Wish, pending transition, hidden hand card, card ghost, or card transfer. While
open it contains focus and blocks underlying input, autoplay, and automatic End
Turn without changing saved automation preferences. Navigation, run replacement,
battle teardown, or opening a peer menu closes it. Escape, backdrop, and the close
button dismiss it and return focus to the opener. Pile measurement wrappers must
match the artwork bounds: their button is block-level so inline baseline spacing
does not shift transfer anchors.

## Enemy inspection

Battle enemy portraits and discovered Bestiary entries open the shared
`EnemyInspectionOverlay`, sharing `InspectionPanel` and `InspectionCardGrid` with
deck inspection. The enemy name is the modal header, followed by Traits
and Abilities headings without a divider. Abilities reuse `BattleCardButton`,
`viewCardWidthClass`, the standard keyword border/hover behavior, and adaptive
card pagination. Cards show portrait art only; effects appear in ordinary card
tooltips on hover or keyboard focus. Inspection cards cannot be played or flipped
and do not inherit the hero's description context. Ability tooltip text is universal: edit the canonical card description once for
all inspection and play surfaces.

Enemy portrait tooltips show traits only, with no repeated-attack text, ability
cards, or upcoming-action indicator. `EnemyTraits` renders the same named trait
sections in Battle hover, Bestiary hover, and the modal. Each subheader pairs a
small static Lucide icon with `ShineText`; colors come from up to three distinct
keywords in description order through `getKeywordTextShineColors`. Descriptions
use the shared keyword tokenizer for bold/color emphasis. No-keyword titles use
the normal neutral fallback. Encounter modifiers use the same rendering and are
shown once in their existing separate group. Enemy trait copy refers to heroes.

Opening inspection dismisses the portrait tooltip through its standard fade.
`useHoverVisible` supports `suspended` and `dismiss`: restored focus must not flash
the old tooltip back; deliberate pointer movement or a new focus visit can show
it again. While the modal is open, Battle input, autoplay, and automatic End Turn
use the shared inspection gate. Opening is restricted to the same safe decision
window as deck inspection. Modal dismissal and focus return follow the shared
overlay lifecycle.

Bestiary clicks retain the enemy sound and Boss music preview. Opening, closing,
and reopening the modal do not restart or stop preview music; existing page/tab
changes still restore menu music. Undiscovered entries retain their current
concealment and audio behavior and cannot open inspection.

## Verification

Use the changed-path route and [test value policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) in CONTRIBUTING. Cover shared interaction behavior and representative browser risks; do not multiply UI tests for every mechanic or cosmetic variant. Interaction
or browser-journey work also follows [tests/e2e/README.md](../tests/e2e/README.md).

## Armory crafting and salvage

Targeting cancellation treats icon descendants, including SVG paths, like their containing controls. Currency targeting survives clicks within the workspace and its recognized controls; salvage targeting survives clicks on salvageable items, the salvage toggle, and the crafting strip. Other clicks cancel targeting. Right-clicks on gear, Trinkets, equipment slots, and crafting currencies leave targeting active; other right-clicks cancel, suppressing the browser context menu only within the workspace. Escape, window blur, and hiding the document also cancel targeting. Activation clicks do not cancel the mode they enable, and cancellation listeners are active without a timer delay. Salvage confirmation owns its own dismissal while targeting listeners are suspended.

Currency artwork shares one 5rem size between the crafting strip, pointer attachment, and salvage preview. The pointer attachment is offset from the hit point, hides for touch and outside the workspace, and never intercepts input. Reward quantities are plain numbers; preview currencies are focusable information groups rather than action buttons.

Selecting an item for salvage immediately ends targeting and clears its cursor and highlights. Confirm, Cancel, and Escape return to browsing. The dialog uses the heading “Salvage,” a wrapping shining item name in “Salvaging [item] will yield:”, a portrait, full-size currency rewards, and an equipped-character warning where applicable. Confirmations focus Cancel, contain keyboard focus, and disable actions during exit.

Crafting consumes one currency per activation. Escape cancels targeting; invalid targets explain their restriction in tooltips and after selection. Success shows actual before/after affix descriptions in a dismissible panel pinned inside the viewport, a brief item pulse, and count feedback only when quantities change. Inventory movement uses a short position transition; reduced-motion preferences disable these animations.
