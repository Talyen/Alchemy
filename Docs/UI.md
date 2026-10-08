# UI system

Canonical owner for UI placement, primitives, interaction, motion, tooltips, and
Alchemy's accessibility stance. Screen wiring checklists remain in
[WORKFLOWS.md](./WORKFLOWS.md#adding-a-new-screen). Armory interaction lives
[in the browsing guide](./UI_BROWSING.md#armory-crafting-and-salvage); Gear data and mutation rules live in
[ARMORY.md](./ARMORY.md).

## Every player action receives feedback

Every supported player action must produce a timely, perceivable response that
acknowledges the input and communicates its outcome. Visible feedback is the
baseline; audio may reinforce it. Essential meaning must remain understandable
with sound muted. Apply this core design principle to all UI, UX, and gameplay
design, implementation, and review.

- Cover pointer actions, keyboard activation, focus and navigation, selection, dismissal, and gameplay actions. Equivalent input methods must communicate the same result.
- A changed screen, visible focus or selected state, updated value, or clear gameplay reaction can satisfy the principle. Reuse shared feedback before adding effects; add extra effects only when they improve clarity.
- Acknowledge delayed actions promptly, show that work is pending, then communicate completion or failure. Distinguish input acknowledgment from successful completion.
- Explain rejected or ineffective actions. Disabled controls must communicate unavailability and its reason through existing inspection or focus patterns without implying success. Valid actions with no effect still need acknowledgment; follow the existing [battle feedback](./UI_BATTLE.md#battle-feedback) conventions for their presentation.
- Match feedback strength to importance and frequency. Keep repeated actions readable without overwhelming animation or sound; group related outcomes where existing presentation rules allow it.
- Preserve meaning under existing motion preferences, mute settings, and audio failures. Static state changes can carry the same meaning as motion. Follow the existing [accessibility stance](#accessibility-stance), [motion](./UI_MOTION.md), and [audio contract](./AUDIO.md#runtime-contract).
- Feedback must reflect resolved gameplay. Animation or sound completion must never determine whether an accepted action commits; preserve the [turn presentation](./GAME_RULES.md#state-turns-and-randomness) contract.
- Unbound keys and clicks on noninteractive scenery require no reaction.

### Examples

| Action                                    | Expected feedback                                                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select a tab                              | The active tab and displayed content visibly change; selecting the current tab can rely on its existing selected state and press feedback.                     |
| Attempt a purchase with insufficient Gold | The unavailable purchase and required Gold are clear, with a reason available on inspection or focus; do not play a purchase-success cue.                      |
| Play a card                               | Acknowledge the play and show the resolved card movement, resource changes, and affected combatants' outcomes, using the existing battle feedback conventions. |
| End Turn                                  | Acknowledge the accepted action and make the discard, enemy, and next-hand sequence visible; gameplay commits independently of playback.                       |
| Craft an item                             | Show pending state if needed, then the resulting item and spent materials; explain rejection or failure without presenting a successful craft.                 |

### Why this matters

- **Confidence and control:** timely feedback lets players tell whether input registered, understand the current state, and choose their next action. It reduces uncertainty and repeated clicks caused by uncertainty. [Nielsen Norman Group, Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/)
- **Game feel and learning:** clear reactions connect actions to consequences and communicate the importance of game events. Pichlmair and Johansen's survey describes feedback amplification as supporting clarity and player empowerment; in Alchemy, these cues should help players understand outcomes as well as feel their impact. [Designing Game Feel: A Survey](https://arxiv.org/abs/2011.09201)
- **Perceivability:** complementary visual and audio cues help players perceive information when one channel is unavailable. The visual baseline is Alchemy's chosen policy, informed by this guidance; it does not imply adoption of the full guideline set. [Xbox Accessibility Guideline 103: Additional channels for visual and audio cues](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103)

## Guide index

| Topic                                                      | Guide                              |
| ---------------------------------------------------------- | ---------------------------------- |
| Shared components, buttons, sizing, colors, accessibility  | This page                          |
| Hover tooltips, modal input, focus and dismissal           | [Interaction](./UI_INTERACTION.md) |
| Screen fades, battle and equipment motion                  | [Motion](./UI_MOTION.md)           |
| Combat feedback, deck and enemy inspection, Corrupted text | [Battle UI](./UI_BATTLE.md)        |
| Collection, Armory, rewards, Wishes, Options and recap     | [Browsing](./UI_BROWSING.md)       |
| Discovery, map layout and room inspection                  | [Labyrinth](./UI_LABYRINTH.md)     |

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
- `Surface` is the shared interactive card/tile owner (`onClick` works for both `button` and `div` renderings; prefer `as="button"` for actions). `PortaledTooltip` with `TooltipPanel` owns tooltip chrome. `ShineText` with `GearItemTitle`/`TrinketItemTitle` (both in `gear-item-title.tsx`) own keyword/item shine typography.
- Item title and affix palettes follow [item shine](#item-shine).
- Shop prices (over card art and inside buttons) use unboxed icon and amount standardized on `text-xl font-semibold text-gold-pale tabular-nums` with a 24px (`h-6 w-6`) coin icon. Over card art, prices float directly on the illustration using multi-layered black contour drop-shadows (`drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] drop-shadow-[0_0_2px_rgba(0,0,0,0.95)]`) without background containers or art fades; inside buttons, prices flow naturally as inline text matching the button's typography. Unaffordable prices transition to `text-muted-foreground`.
- `TraitBox` owns unboxed Trait rows, colored icons, keyword descriptions, and title shine across Labyrinth map details and enemy hover/inspection. Traits have no individual border, background, or box padding. Encounter icon themes live in shared configuration and also drive map effects. Enemy Traits and encounter modifiers form one deduplicated list; inspection uses two equal columns at 40rem of available content width, with a single-column fallback and full-width sole Traits. Hover and map Traits stay stacked. Apply inline-size containment only to the inspection layout: shrink-to-fit tooltips need their contents to contribute intrinsic width.
- Modal interaction and dismissal follow [Overlay lifecycle](./UI_INTERACTION.md#overlay-lifecycle).

### Item shine

Astral instance titles and borders derive their shine keywords from the rolled affix descriptions, using the same keyword recognition as tooltip text (`src/lib/keyword-text.ts`). Base affinity only prioritizes present keywords for the three-keyword title limit; it never adds absent keywords.

Card artwork shine uses keywords found in the displayed description. Conditional keywords such as Pack Tactics' Wish color its border; mechanics such as a summon card's hidden Consume do not. Battle and inspection cards use the same neutral shine when no keyword appears.

Max-roll Astral and Unique affix names use the first three distinct keywords from their own description, including aliases such as Stunned, Frozen, and Consumed. Tooltip entries carry affix identity and normalized value together so description text and max-roll shine cannot diverge. Text uses each keyword’s primary color with a 55%-opacity stop. Single-keyword borders retain the keyword's full 3-stop pulse (`[light, dark, light]`), while multi-keyword borders normalize to each keyword’s primary accent color looped back to the first (`[k1, k2, k1]` or `[k1, k2, k3, k1]`) to maintain a consistent cadence and visual tempo across all items. Trinket titles use at most three described keywords in description order. Artwork palettes remain independent.

Astral definition-only previews use base affinities; Unique definition borders use their described effect. Unique item borders use the same keyword shine as Astral gear rather than a gold palette, while Unique item titles keep their gold palette. Gear hover backgrounds use only described affix keywords, with neutral gray for no recognized keywords; Unique gear keeps the gold hex pair for its inventory, equipped-slot, and collection hover background. CSS text fades must not feed the hex-only background renderer.

## UI gold palette

General interface gold uses one warm family: base `#cd9b51`, light `#e6c58e`,
deep `#986b32`, and pale `#f3e4ca`. `UI_GOLD` in
`src/lib/game-constants/ui-colors.ts` owns the hex values needed by plasma;
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

Battle pile artwork, the gold counter, and the main menu logo use the standard 103.5% CSS hover scale over 200ms ease-out. Pile transfer anchors remain unscaled. Individual mana crystals stay at their resting size on hover and play a brief glint masked to their artwork, preserving their independent refresh animations and dim spent appearance. Reduced motion replaces the glint sweep with a static highlight. Battle's End Turn button uses standard secondary outline styling, grounded border, and hover illumination without scaling or bloom.

Artwork surfaces resolve their clipping radius from the same inline theme token and local content scale as the outer frame. The artwork radius subtracts the frame width so portrait and landscape corners meet in resting, hovered, and selected states.

Labyrinth's rectangular art nodes reuse `Surface`, shared shimmer, and Shine Border. Hover, keyboard focus, and selection enlarge only the emphasized tile to 106%; unknown tiles stay neutral. Completed art remains subdued. Reduced motion makes emphasis immediate and shine static. See [Labyrinth map](./UI_LABYRINTH.md#labyrinth-map) for discovery and movement.

## Accessibility stance

Alchemy is visual-heavy and intentionally ships no dedicated accessibility
feature set beyond semantic robustness. Preserve semantic buttons,
programmatic names and states, keyboard behavior supplied by shared primitives,
and `aria-hidden` on decorative art. Preserve and reuse shared dialog focus
containment and restoration for confirmations, card inspection, and enemy
inspection, following [overlay lifecycle](./UI_INTERACTION.md#overlay-lifecycle). New focus behavior
outside that contract, screen-reader announcement systems, contrast tooling,
and per-component reduced-motion variants require a product decision.
Preserve the existing [equipment transfer reduced-motion handling](./UI_MOTION.md#equipment-movement-animations).
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

Use one 24px gap in content units between a header and its main body. Meaningful
helper text uses 12px above it and 16px before the primary content. Talents uses
one 16px header gap, with no additional pane top padding. Preserve bounded
resource, selection, and talent-footer reservations needed for stable actions;
size those reservations in content units.

Card Shop removal keeps its height-aware picker inside a centered, content-scaled
maximum height and standard page gutters. Its available fitting area can shrink
on short windows without stretching the footer toward taller window edges.

Collection and Homestead center real items in wrapping rows, without layout-only
fillers. Partial pages keep pagination immediately beneath the items; single-page
views render neither pagination nor its wrapper. Picker measurement containers
must receive available width independently of their rendered card count, so
resizing cannot feed a narrower row back into its own column calculation.

Desktop Main Menu pairs Quit on the bottom left with Options on the right. Quit
uses a rose-colored Power icon; browser Options remains centered. Demo completion
uses standard page gutters and fits its complete image into the remaining area.
The loading caption preserves 12px at the reference viewport and follows the
game's proportional scale from there. Error Log scroll caps use stage units.

## Display sizing

On macOS, both desktop fullscreen modes fill the entire display, including the area beside the camera notch, using Electron simple fullscreen. They stay on the current desktop rather than opening a native fullscreen Space. Windowed mode restores the standard movable, resizable window. Do not request native or HTML fullscreen on macOS: it reserves a black strip at the notch.

Talents on the end-run screen and Mystery rewards keep fixed-width boxes in centered, balanced rows. Use the fewest rows that fit (up to five boxes per row), distribute counts with at most one box of difference, and place larger rows first. Recalculate when available width or Game Size changes.

The virtual stage owns available-space geometry and battle coordinates. Auto
fills the available viewport; explicit aspect ratios retain their fitted frame.
Content uniformly fits a reference composition based on the MacBook browser's
1470 × 738 CSS-pixel game area, including the height lost to browser bars and the
Dock. At 100% Game Size, the reference retains its original content scale of
738 / 1080. Fit content against both frame width and height, then multiply by
Game Size (80–120%, 5% steps). Wider or taller frames gain background space;
there is no separate large-window growth curve or content-scale cap. Use CSS
viewport dimensions, never device pixel ratio, for layout. The root font remains
16px. Small text uses 16px (`text-sm`) and 14px (`text-xs`) before content scaling, including compact controls, select options, tooltip text, keyword tags, resource labels, and feedback. Artwork preserves its aspect ratio and intentional crops.

Hover tooltips retain their original untransformed size at the reference browser
viewport. Their scale is visible game content scale divided by the reference
content scale (738 / 1080), multiplied by Tooltip Size (90–125%, 5% steps).
At 100%, tooltip text, icons, spacing, and panels grow proportionally with the
game, including enemy Traits. Tooltip Size is an additional
relative adjustment, not a fixed pixel size independent of Game Size.

The stage's `--content-scale` is visible content scale divided by stage scale.
Inline Tailwind theme tokens and `--content-rem` size text, controls, cards,
spacing, and panels once. Percentage anchors and layout regions follow the
stage. Authored arbitrary content dimensions must use the content unit; do not
use raw container-height units as the primary card size. Available-space caps
are allowed: the battle hand caps card height, compresses its fan into the
reserved center region, and reserves extra bottom space for larger hands.
Draw and Discard artwork use 80% of the resting hand card width, sharing its
responsive size from the bottom bar. Mana and End Turn sit above the aligned piles,
with End Turn styled as a compact secondary action centered over the discard pile.
The battle toolbar places live Gold before the inspection controls, with a brief
highlight on increases. Dev-only Skip Combat uses a labeled skip-forward icon
and tooltip immediately before Menu.
The battle bottom bar reserves content-sized side controls and gives the hand
the remaining width. Side controls stay stationary as the hand grows to seven
cards; smaller hands remain centered with capped spacing. Hand hover and pointer
activation use the nearest stable slot center, with boundaries halfway between
centers, independent of raised artwork and reflow motion. Hidden transfer cards
cannot receive pointer selection. Keyboard focus uses the native card buttons.
Enlarged actors shift upward to keep health and battle controls clear. Backgrounds
fill the frame.

## Verification

Use the changed-path route and [test value policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) in CONTRIBUTING. Cover shared interaction behavior and representative browser risks; do not multiply UI tests for every mechanic or cosmetic variant. Interaction
or browser-journey work also follows [tests/e2e/README.md](../tests/e2e/README.md).

## Plasma availability

`KeywordPlasmaBackground` uses the single WebGL renderer entry point in
`keyword-plasma.ts`. A failed context/shader setup or lost context shows a static
CSS gradient with the same interaction colors, focal offset, blending, and
intensity. Hide that gradient while WebGL is available to avoid doubling the
glow. Context restoration rebuilds resources once; do not poll or keep a second
animated Canvas backend. Zero intensity hides both layers, and motion-disabled
preferences keep their existing unanimated appearance without color-animation
frames. Availability belongs to the renderer lifecycle; failures are logged,
not shown in a player-facing dialog.

## Display options

Display groups Display Mode (desktop only), Aspect Ratio, Brightness, Game Size,
and Tooltip Size together. The Background section contains Background Glow and
Background Particles. Screen Effects and Drifting Lights have been removed,
including their renderers and saved preferences. Reset to Default restores the
remaining preferences and device sizes.
