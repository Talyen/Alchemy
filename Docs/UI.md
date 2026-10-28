# UI system

Shared UI placement, primitives, sizing and accessibility live here. The
[guide index](#guide-index) routes interaction, motion and feature presentation. Screen wiring checklists remain in
[WORKFLOWS.md](./WORKFLOWS.md#adding-a-new-screen). Armory interaction lives
[in the browsing guide](./UI_BROWSING.md#armory-crafting-and-salvage); Gear data and mutation rules live in
[ARMORY.md](./ARMORY.md).

## Show, don't tell

Avoid taglines, avoid helper text, avoid secondary labels - if a screen needs them to make sense, fix the layout instead.

Aim for a minimalist, polished game UI. Default to concise labels, interactive
cards, visible selection and resource changes, and clear outcomes. Do not add
instructional text, descriptive paragraphs, or redundant success messages to
every screen or control you touch. If the interface already shows it, omit the
explanation. Prefer improving the interaction over explaining it.

Keep essential mechanics in cards or inspection, preserve accessible names, and
use concise errors when an action fails. Feedback need not be prose: a resulting
card, healing meter, changed value, or selected state can communicate the outcome.

## Every player action receives feedback

Every supported pointer, keyboard and gameplay action needs a timely, visible
response that acknowledges input and communicates its outcome. Audio may reinforce
it; essential meaning must survive mute or playback failure.

- Use changed state, focus, selection, resource values or resolved gameplay to
  communicate success. A selected tab can rely on its selected state and press feedback.
- For delayed work, acknowledge input promptly, show pending state, then success
  or failure. A purchase-success cue must never acknowledge insufficient Gold.
- Explain rejected or ineffective actions through existing feedback/inspection.
  Disabled controls expose their reason on inspection or focus. Valid no-effect
  actions follow [battle feedback](./UI_BATTLE.md#battle-feedback).
- Match feedback strength to consequence and frequency, using shared effects and
  grouping. Preserve meaning with existing motion preferences and muted or failed audio.
- Equivalent inputs communicate the same result. Unbound keys and noninteractive
  scenery need no reaction. Animation and sound never decide gameplay acceptance.

Back and Escape dismiss the topmost overlay, then step back within the current
screen, then return to its caller. Armory, Collection, Homestead, Talents and
Options keep a browsing history separate from the saved run activity. Returning
to Main Menu clears that history; an active run alone never makes Back resume it.
Run-origin browsing resumes the current saved activity, and the game menu's
explicit Return to Run action remains available. Gameplay roots open the game
menu on Escape rather than undoing committed choices or skipping rewards.

This policy follows the usability rationale in
[Nielsen Norman Group's visibility principle](https://www.nngroup.com/articles/visibility-system-status/),
[Designing Game Feel](https://arxiv.org/abs/2011.09201) and
[Xbox's complementary-channel guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103).
Alchemy's [accessibility stance](#accessibility-stance) defines its actual scope.

## Guide index

| Topic                                                                      | Guide                              |
| -------------------------------------------------------------------------- | ---------------------------------- |
| Shared components, buttons, sizing, colors, accessibility                  | This page                          |
| Hover tooltips, modal input, focus and dismissal                           | [Interaction](./UI_INTERACTION.md) |
| Shared screen reveals and canvas lifetimes                                 | [Motion](./UI_MOTION.md)           |
| Combat feedback, deck and enemy inspection, Corrupted text                 | [Battle UI](./UI_BATTLE.md)        |
| Collection, Homestead, Talents, Armory, rewards, Wishes, Options and recap | [Browsing](./UI_BROWSING.md)       |
| Discovery, map layout and room inspection                                  | [Labyrinth](./UI_LABYRINTH.md)     |

## Placement and boundaries

- `src/components/ui/` owns generic Tailwind/Radix primitives with no game-domain knowledge. These components receive domain data through props and do not import `@/features` or subscribe to gameplay stores.
- `src/features/alchemy/shared/ui/` owns reusable game widgets such as cards, destination choices, item tiles, and inspection overlays. They receive run, battle, and session data through props. Presentation-only `ui-store` state is allowed. Battle status icons and combatant panels belong to `run-loop/battle/presentation/ui/`; Labyrinth map nodes belong to `run-loop/screens/labyrinth/`.
- Screens and feature-local presentation stay with their owning feature until at least two feature domains need the same widget. Collection presentation belongs in `meta/screens/collection/`; shop purchase and service widgets belong in `run-loop/shop/ui/`. Mystery outcome badges belong in `run-loop/screens/mystery/`; Options panels, controls, and the error-log viewer belong in `meta/screens/options/`. Import shared widgets directly from their owning modules.
- Static catalogs used by shared game widgets come from `shared/config/game-data-catalog.ts`, not the token `config/` barrel.

Use `ScreenShell`, `TitledScreenShell`, `ScreenHeader`, and `PageLayout` for page structure. Use shared chrome before recreating buttons, progress bars, switches, cards, or tooltips.

## Component conventions

- Use plain prop functions rather than `React.FC`; React 19 components receive `ref` directly as a prop.
- When a hook returns callback refs alongside layout values, destructure them before JSX so React Compiler can distinguish callbacks from ref objects.
- Use `cn()` for conditional classes and existing CVA variants for semantic states.
- Generic interactive primitives preserve standard ARIA roles, names, values, keyboard behavior, and disabled states. Eligible talent nodes use native buttons for Enter and Space; keyword trees without portrait art remain selectable using a blank portrait and the keyword icon.
- Talent nodes keep a neutral reading surface with centered icon, title and rules. Locked content is muted and mostly grayscale; available choices have a lighter neutral frame that gently drifts while their content stays still. Owned borders use the category color. Unlock moves only the rounded frame and glow, preserving text and icon coordinates. Nodes grow for localized content, and reduced motion or disabled animations keep available and owned states still.
- `Surface` is the shared interactive card/tile owner (`onClick` works for both `button` and `div` renderings; prefer `as="button"` for actions). Callbacks receive the chosen element's click event; keyboard activation of a div dispatches a click. `PortaledTooltip` with `TooltipPanel` owns tooltip chrome. `ShineText` with `GearItemTitle`/`TrinketItemTitle` (both in `gear-item-title.tsx`) own keyword/item shine typography. Gradient text resets inherited text strokes to keep letter interiors clean; use a dark drop shadow for contrast. Nonempty keyword palettes include the shared white shine highlight, including palettes with multiple keywords.
- Item title and affix palettes follow [item shine](#item-shine).
- Shop-specific price presentation follows [Browsing UI](./UI_BROWSING.md#shop-prices).
- `TraitBox` supplies shared Trait presentation; [enemy inspection](./UI_BATTLE.md#enemy-inspection) owns its layout across hover, inspection and map details.
- Modal interaction and dismissal follow [Overlay lifecycle](./UI_INTERACTION.md#overlay-lifecycle).

`Progress` requires an accessible name (`aria-label` or `aria-labelledby`); `value`
owns fill width, while `fillStyle` carries extra styling only. `ShineBorder` is
decorative (`aria-hidden`) and absolute with inherited rounding: its parent must
be relative and rounded. Empty palettes use neutral shine. Hover, focus and
persistent shine are border-only, without outer glow; keep borders outside artwork
clips. [Component styles](../src/styles/components.css) own opacity and transitions.
Wildcard uses the same static border as other heroes. Turn indicators and
Death's Door decoration retain border-only shine.

### Item shine

Astral instance titles and borders derive their shine keywords from the rolled affix descriptions, using the same keyword recognition as tooltip text (`src/lib/keyword-text.ts`). Base affinity only prioritizes present keywords for the three-keyword title limit; it never adds absent keywords.

Card artwork shine uses keywords found in the displayed description. Conditional keywords such as Pack Tactics' Wish color its border; mechanics absent from the description do not add keyword shine. Battle and inspection cards use the same neutral shine when no keyword appears.

Max-roll Astral and Unique affix names use the first three distinct keywords from their own description, including aliases such as Stunned, Frozen, and Consumed. Tooltip entries carry affix identity and normalized value together so description text and max-roll shine cannot diverge. Text uses each keyword’s primary color with a 55%-opacity stop. Single-keyword borders retain the keyword's full 3-stop pulse (`[light, dark, light]`), while multi-keyword borders normalize to each keyword’s primary accent color looped back to the first (`[k1, k2, k1]` or `[k1, k2, k3, k1]`) to maintain a consistent cadence and visual tempo across all items. Trinket titles use at most three described keywords in description order. Artwork palettes remain independent.

Astral definition-only previews use base affinities; Unique definition borders use their described effect. Unique item borders use the same keyword shine as Astral gear rather than a gold palette, while Unique item titles keep their gold palette. Gear hover backgrounds use only described affix keywords, with neutral gray for no recognized keywords; Unique gear keeps the gold hex pair for its inventory, equipped-slot, and collection hover background. CSS text fades must not feed the hex-only background renderer.

## Icons

Lucide icons default to `1em` square and a `2.5` stroke in `src/styles/base.css`,
matching the inherited text font size. Put text size on the shared icon/label
container so both scale together; omit icon width and height utilities for text
controls. Explicit dimensions are reserved for artwork, status markers, and
comparison diagrams. Icon-only buttons set their font size through `Button`.

## UI gold palette

General interface gold uses one warm base/light/deep/pale family.
[`UI_GOLD`](../src/lib/game-constants/ui-colors.ts) owns the hex values needed by plasma;
`src/styles/theme.css` mirrors them as `gold-base/light/deep/pale` utilities.
Architecture smoke enforces parity. Primary controls use base gold, availability
borders pulse light → deep → light, and prices and warm headings use pale gold.
Collection and rating accents use light gold. Unique titles use pale gold with
their existing opacity pulse; Unique hover effects use the same gold family.

Use `warning` and `warning-surface` for caution notices and confirmation icons.
Keyword, material, character, and encounter palettes remain content-owned, even
when they contain amber. Do not replace those colors as decorative UI gold.

## Buttons and interactive surfaces

`Button` (`src/components/ui/button.tsx`) owns its shape (`rounded-xl`), hover layers, and size variants. Width classes (`min-w-56`, `w-56`, menu width) are plain Tailwind literals at the call sites; `ShineAccentButton` keeps its own small width map for its `width` prop.

`Button` always renders a native button defaulting to `type="button"`; pass an explicit `type` for the rare in-form submit/reset. `wrapperClassName` optionally adds a layout span; `className`, refs, event handlers, and native button attributes belong to the button itself.

Secondary (`outline`) and `ghost` buttons and `ChromeIconButton` use fully opaque fills: a solid base fill with solid hover and press feedback, never reduced alpha, so background plasma, particles, and screens cannot show through them. Art-tile controls where the artwork itself is the surface (`Surface as="button"`, card and portrait buttons) and badges or prices floating over artwork are not button fills and keep their existing transparency.

Which control to reach for: `Button` owns text/label actions (Play, Back, Confirm, pagination, dialogs, icon chrome via `ChromeIconButton`); `Surface as="button"` owns art frames and tiles (cards, chooser art, portrait tiles). Native `<button>` stays for compositions neither covers without changing the DOM: whole-card buttons whose frame wraps an inner art `Surface` plus text (difficulty cards), portrait buttons pairing an art `Surface` with a label row (talent overview), art chips with custom tooltip/stopPropagation wiring (currencies, status icons, salvage toggle), and underline text dismiss actions inside toasts. Keep those native buttons typed with accessible names; do not rebuild them as `Button` (wrong chrome) or `Surface` (adds surface frame, clip wrapper, and transform variables that change the painted result).

- **Shape** — Rounded rectangles: the `Button` primitive owns `rounded-xl` (it cannot import `@/features`); feature-side wrappers repeat the same literal
- **Primary** — `Button variant="primary"` for Play, Continue, and Confirm
- **Secondary** — `Button variant="outline"` for Back, Cancel, Skip, and alternate navigation
- **Accent** — `ShineAccentButton` only for accent-intent forward actions
- **Paired actions** — Secondary left and primary right; inline width classes (`min-w-56`, `w-56`)
- **Equal choices** — `DestinationChoices` and `Surface`, with an accessible tile name
- **Tabs** — `TabBar`
- **Chrome icons** — [ChromeIconButton](../src/features/alchemy/shared/ui/chrome-icon-button.tsx) owns header and battle-corner icon buttons, including shared hover, active, and toggle feedback.
- **Hover / press** — Primary buttons use CSS bloom without scaling; secondary buttons use background feedback and text/border illumination; destructive buttons use background hover and distinct active press feedback. Preserve surface-specific CSS scaling and shared `active:` feedback; do not add parallel Motion hover scaling.

Card and collection artwork, including gear and trinket tiles, reserves a 1px frame across available, selected, disabled, purchased, and shine states, so changing interaction state cannot resize its artwork or row or recenter the screen. The thicker hover and selection outline is an absolute overlay, preserving the thin default border. Hover-only shine uses `card-art-shine`; persistent shine uses `has-shine-border`. Armory item borders are hover-only, with keyboard focus matching hover; the active equipment slot keeps its shine as a selection marker. Both hide the frame color while preserving its space. Pass frame Shine through `Surface.overlay` so the artwork clipping layer cannot hide it.

The Gold counter and Main Menu logo use the standard hover scale and transition
from [component styles](../src/styles/components.css). Battle controls follow [Battle layout](./UI_BATTLE.md#battle-layout).

Artwork surfaces resolve their clipping radius from the same inline theme token and local content scale as the outer frame. The artwork radius subtracts the frame width so portrait and landscape corners meet in resting, hovered, and selected states.

Labyrinth nodes reuse `Surface`, shimmer and Shine Border under the
[map interaction and presentation contract](./UI_LABYRINTH.md#labyrinth-map).

## Accessibility stance

Alchemy is visual-heavy and intentionally ships no dedicated accessibility
feature set beyond semantic robustness. Preserve semantic buttons,
programmatic names and states, keyboard behavior supplied by shared primitives,
and `aria-hidden` on decorative art. Preserve and reuse shared dialog focus
containment and restoration for confirmations, card inspection, and enemy
inspection, following [overlay lifecycle](./UI_INTERACTION.md#overlay-lifecycle). New focus behavior
outside that contract, screen-reader announcement systems, contrast tooling,
and per-component reduced-motion variants require a product decision.
Preserve the existing [equipment transfer reduced-motion handling](./UI_BROWSING.md#equipment-movement-animations).
Shared motion accommodations live in
`src/styles/keyframes.css` and `src/styles/components.css`; Armory also disables
inventory movement and crafting feedback motion locally in
`armory/item-picker-grid.tsx`, `armory/trinket-picker-grid.tsx`, and
`armory/armory-screen.css` under `meta/screens/`.

Oxlint checks keyboard counterparts for click actions and rejects focusable
controls marked `aria-hidden`. Prefer native buttons with exposed state (for
example, Error Log expansion uses `aria-expanded`). Backdrops and click shields
may use line-scoped, explained exceptions: their keyboard behavior belongs to
the existing Escape handler and child controls, not an extra action on the wrapper.

## Page sizing and spacing

`ScreenShell` fits its content by default. `PageLayout` centers the complete
header, body, and action group when it fits, and scrolls vertically when needed.
Keep full available-space geometry for Battle, Armory, and Labyrinth. Do not use
viewport-height minimums to add empty space to ordinary pages.

Use one 24px gap in content units between a header and its main body. Preserve bounded
resource, selection and footer reservations needed for stable actions;
size those reservations in content units. [Talents](../src/features/alchemy/meta/screens/talents-screen.tsx)
retains its tighter header spacing in its layout owner.

Picker measurement containers receive available width independently of rendered
item count, preventing resize feedback into their own column calculation.
Screen-specific geometry belongs in [Browsing](./UI_BROWSING.md),
[Battle](./UI_BATTLE.md) and [Labyrinth](./UI_LABYRINTH.md).

## Display sizing

On macOS, both desktop fullscreen modes fill the entire display, including the area beside the camera notch, using Electron simple fullscreen. They stay on the current desktop rather than opening a native fullscreen Space. Windowed mode restores the standard movable, resizable window. Do not request native or HTML fullscreen on macOS: it reserves a black strip at the notch.

The virtual stage owns available-space geometry and battle coordinates. It
always fills the available viewport without letterboxing. Viewport dimensions
determine the stage proportions; forced aspect ratios are not supported.
Automatic density uses the established 1280 × 720 CSS-pixel layout as its anchor.
Fit that 16:9 anchor against both available dimensions: 16:9 and wider windows
therefore share the same content size at the same height, while narrower windows
fit by width. Below the anchor, shrink proportionally. Above it, content takes
72% of the additional viewport growth, retaining readable growth without a hard
cap. The 1470 × 738 MacBook authoring reference still defines the underlying
content and tooltip units; it no longer dictates the fit aspect ratio.
Multiply automatic density by Game Size (80–120%, 5% steps). Wider or taller
frames gain playing space. Use CSS viewport dimensions, never device pixel ratio,
for layout. The root font remains 16px. Small text uses 16px (`text-sm`) and 14px
(`text-xs`) before content scaling, including compact controls, select options,
tooltip text, keyword tags, resource labels, and feedback. Artwork preserves its
aspect ratio and intentional crops.

Hover tooltips follow visible game content scale divided by the retained authored
baseline (738 / 1080), multiplied by Tooltip Size (90–125%, 5% steps). Tooltip
Size remains a relative adjustment; it does not change game layout or impose a
separate growth curve. Text, icons, spacing, and panels inherit that scale once.

The stage's `--content-scale` is visible content scale divided by stage scale.
Inline Tailwind theme tokens and `--content-rem` size text, controls, cards,
spacing, and panels once. Percentage anchors and layout regions follow the
stage. Authored arbitrary content dimensions must use the content unit; do not
use raw container-height units as the primary card size. Available-space caps
are allowed: the battle hand caps card height and compresses its fan into the
reserved center region.
Battle-specific hand, Mana, toolbar and actor geometry follows
[Battle layout](./UI_BATTLE.md#battle-layout).

## Verification

Player-facing visual and interaction changes must improve on the current implementation through [rendered comparison](./UI_VISUAL_REVIEW.md). Preserve what works, simplify first, and judge the whole screen. Screenshots and passing tests alone do not establish quality.

Use the changed-path route and [test value policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) in CONTRIBUTING. Cover shared interaction behavior and representative browser risks; do not multiply UI tests for every mechanic or cosmetic variant. Interaction
or browser-journey work also follows [tests/e2e/README.md](../tests/e2e/README.md).

## Plasma availability

Plasma has one WebGL renderer with a matching static CSS fallback when unavailable.
Zero intensity hides both; motion-disabled preferences stay unanimated. Hover colors
retarget smoothly while object highlights respond immediately.
[Canvas rendering](./UI_MOTION.md#canvas-rendering) owns failure, cleanup and rendering limits.

## Pending saves and action feedback

Persisted actions acknowledge input immediately with Saving… and `aria-busy`.
Completion feedback, changed progress values, and onward progression wait for a
successful local save. Both-slot failure shows Couldn’t save with a reachable Retry
button; retries preserve the original cost and outcome. Inspection, Collection
browsing, navigation without progress changes, and sound/display controls remain
usable. Pending state is transient and requires no new provider or save fields.
