# Plan: Migrate Tooltips to a Root-Scale Overlay Layer

## Goal

Render every hover tooltip in a single root-space overlay layer at constant
CSS-pixel scale — the same physical size enemy tooltips use today. This
eliminates the stage-scale downscaling that makes in-stage tooltips render too
small on dense/small displays (e.g. a Retina laptop at stage scale ~0.766 vs. a
4K monitor at ~1.0).

## Problem

The game is a fixed 1080p virtual stage scaled with `transform: scale(scale)`
to fit the viewport (`getVirtualResolutionLayout`, `shared/hooks.ts`). Any
tooltip rendered inside the stage is in stage space and shrinks with the window.
Tooltips rendered via portal escape the transform and stay at 1:1 CSS pixels.

Tooltips are ephemeral, reading-heavy overlay UI. They belong in root space —
constant physical size regardless of stage scale or display. The app already has
the infrastructure (`PortaledTooltip`, `#tooltip-root`) but only a minority of
tooltip sites use it.

Today there are two coordinate spaces (stage + root) and tooltips live in both.
This is the defect; portaling the remaining tooltips is resolving an
inconsistency, not patching.

## Inventory

### Already portaled (root scale — the target behavior)

| Site                                | File                                          |
| ----------------------------------- | --------------------------------------------- |
| Enemy tooltip (battle + collection) | `shared/ui/enemy-tooltip.tsx`                 |
| Armory gear tooltip                 | `meta/screens/armory/gear-tooltip-portal.tsx` |
| Armory currency tooltip             | `meta/screens/armory/parts/currency-tile.tsx` |
| Battle status chips                 | `shared/ui/battle/status-icons.tsx`           |

### In-stage (stage scale — to migrate)

State-driven:

| Site                           | File                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| Card popup (`DetailPopup`)     | `shared/ui/card-popup.tsx`                                     |
| Gear popup (`GearDetailPopup`) | `shared/ui/gear-detail-popup.tsx`                              |
| Talent node tooltip            | `meta/talents/talent-tree.tsx`                                 |
| Labyrinth node tooltip         | `run-loop/screens/labyrinth/labyrinth-node-tooltip.tsx`        |
| Character select tooltip       | `run-setup/screens/character-select-screen.tsx`                |
| Game mode select tooltip       | `meta/screens/game-mode-select-screen.tsx`                     |
| Locked menu item tooltip       | `shared/ui/locked-menu-item.tsx`, `locked-feature-tooltip.tsx` |

Pure CSS-hover (`group` + `opacity-0 group-hover:opacity-100`):

| Site                                                 | File                                               |
| ---------------------------------------------------- | -------------------------------------------------- |
| Keyword tag tooltip                                  | `shared/ui/keyword-tag.tsx`                        |
| Keyword token tooltip (nested in `DescriptionLines`) | `shared/ui/card-description-ui.tsx`                |
| Disabled service button tooltip                      | `shared/ui/service-button.tsx`                     |
| Actor panel fallback tooltip                         | `shared/ui/battle/actor-panel-helpers.tsx`         |
| Companion panel tooltip                              | `shared/ui/battle/companion-panel.tsx`             |
| Difficulty select lock tooltip                       | `run-setup/screens/difficulty-select-screen.tsx`   |
| Mystery choice effect tooltip                        | `run-loop/screens/mystery/mystery-event-intro.tsx` |

`DetailPopup` is the highest-traffic consumer. It is used by `card-button`,
`collection-tile`, `rewards-screen` (×2), homestead `companion-node` /
`upgrade-node`, `mystery-reward-summary`, and `purchasable-trinket-item`.
`GearDetailPopup` is used by `purchasable-gear-item`.

## Plan

### Phase 1 — Overlay layer + core primitive

1. Convert `#tooltip-root` (App.tsx:254) to a full-viewport
   `fixed inset-0 pointer-events-none z-[130]` layer (currently `absolute
inset-0 z-30` inside the letterboxed frame). `fixed` tooltips are already
   viewport-anchored regardless of the frame, so the change is about coverage
   and stacking: the layer must span the viewport and sit above the game menu /
   dialog overlays (`z-[120]`/`z-[121]`) so portaled tooltips (including
   locked-menu tooltips, today `z-[130]` in-stage) never drop below them. The
   layer is `pointer-events-none`, so a high z-index blocks nothing;
   `pointerEventsAuto` popups never coexist with modals.
2. Extend `PortaledTooltip` (`shared/ui/portaled-tooltip.tsx`):
   - Portal into the overlay layer instead of `document.body`, via a
     ref/context target rather than `getElementById` (the overlay renders as a
     later sibling of the tooltip-producing tree).
   - Add a `pointerEventsAuto` prop — card popups are interactive today
     (`pointer-events-auto`). Forward `onMouseEnter` / `onMouseLeave` so
     consumers can keep the popup mounted while the pointer is over it (hover
     handoff; see Phase 2).
   - Add a delayed-unmount mode so hide still fades out (CSS-hover tooltips
     currently fade both ways; `PortaledTooltip` unmounts on hide today).
   - Add an optional stage-relative `maxWidth` cap (e.g. ~40% of stage width)
     so fixed-size tooltips cannot dominate small windows.
   - Add side-start / side-end placement to `usePortaledTooltipPlacement`
     (`shared/ui/portaled-tooltip-placement.ts`) for locked menu items,
     reproducing `useTooltipSidePlacement`'s side-flip (not above/below) and
     the `translateY(-50%)` vertical centering from
     `.hover-popup-panel[data-placement^="side-"]`.
3. Add a small `useHoverVisible()` hook (trigger ref + mouseenter/leave and
   focus/blur state) so CSS-hover tooltips convert with uniform churn without
   dropping keyboard (`group-focus-within`) parity.
4. Fix `tooltips-disabled` parity. Today the class is applied to the vr-stage
   (App.tsx:167) and only hides stage-descendant tooltips (components.css:135);
   portaled tooltips escape it — a latent bug. Apply the class to the overlay
   root when `tooltipBlocked`. Mechanically this means lifting
   `useRenderedScreenTransition` (or just its `tooltipBlocked` result) from
   `AppMainContent` to `AppInner`, since the overlay root lives in `AppInner`
   and props flow downward.

### Phase 2 — State-driven tooltips (mechanical)

Swap `useTooltipFlip` / `useTooltipViewportClamp` + inline `TooltipPanel` for
`PortaledTooltip`, reusing existing trigger/hover state. Thread `triggerRef` for
`DetailPopup` / `GearDetailPopup` through their consumers. `locked-menu-item`
uses the new side placement support.

`DetailPopup` / `GearDetailPopup` additionally get:

- **Trigger-width matching:** measure the trigger's rect and size the popup to
  it. Today `w-full` mirrors the card's rendered width; a portaled `w-full`
  would resolve to the overlay width. The popup keeps mirroring the card at any
  stage scale.
- **Hover handoff:** the popup is currently a DOM child of the card wrapper, so
  moving the cursor onto it never fires mouseleave. Portaled, crossing the
  anchor gap would unmount it. Keep it mounted while the pointer is over the
  trigger OR the popup (via `PortaledTooltip`'s forwarded mouse handlers) so
  nested keyword tooltips stay reachable.

### Phase 3 — CSS-hover tooltips (bulk)

Convert `group` + `opacity-0 group-hover:opacity-100` wrappers (keyword-tag,
`KeywordToken`, service-button, actor-panel fallback, companion-panel,
difficulty-select, mystery-event-intro) to trigger-ref + `useHoverVisible`.
Note `KeywordTag` / `KeywordToken` are hybrids — they already run
`useTooltipViewportClamp` for flip/clamp, so only their visibility moves to the
hook. Keep `useHoverVisible`'s focus handling so `mystery-event-intro`'s
`group-focus-within` keyboard parity survives.

Do `KeywordToken` / `KeywordTag` first: it is nested inside `DescriptionLines`
everywhere, including inside portaled tooltips. Nested-trigger behavior —
especially inside the `pointer-events-auto` card popup with hover handoff —
needs early verification.

### Phase 4 — cq-unit cleanup + small-window cap

Tooltips with `cqh`-based widths must become root-scale widths, since cq
resolves against the vr-stage container and a portaled tooltip has no container:

- `labyrinth-node-tooltip.tsx` — `w-[28.44cqh]`
- `mystery-event-intro.tsx` — `w-[28.44cqh]`

Audit every tooltip panel for other cq units (`cqh`, `cqw`, `clamp(...cqh)`).
Keep `cqh` on trigger chrome that stays in-stage (e.g. status chip icons).

Apply the Phase 1 stage-relative `maxWidth` cap to wide tooltips so a fixed
root-scale size cannot dominate a small stage.

### Phase 5 — Simplify + verify

- Prune now-dead `:has()` / group-hover rules for migrated components in
  `styles/components.css`, keeping `.tooltips-disabled` behavior on the overlay.
- Run path-scoped gates for the touched areas (battle, armory/shop, meta
  screens) per CONTRIBUTING.md.
- Visually verify tooltips are pixel-identical at stage scales ~0.766 vs ~1.0,
  including letterboxed frames, flip-below, edge clamps, hover handoff into
  interactive popups, and fade-out on hide.
- Review/adjust E2E hover specs (selector + flow). Animation and canary specs
  use raw `@playwright/test` — no `enableFastMode` / `fastBattle`.

## Risks / decisions

- **Side placement:** extend portaled placement rather than leaving locked-menu
  tooltips in-stage, to keep one uniform path. The portaled side placement must
  reproduce `useTooltipSidePlacement`'s side-flip semantics and the
  `translateY(-50%)` vertical centering.
- **Stacking order:** the overlay layer must sit above the game menu / dialog
  overlays (`z-[120]`/`z-[121]`), otherwise portaled locked-menu tooltips (today
  `z-[130]` in-stage) would render below the menu. `pointer-events-none` makes a
  high overlay z-index safe; `pointerEventsAuto` popups never coexist with
  modals.
- **Hover timing:** CSS-hover tooltips currently stay mounted and fade;
  `PortaledTooltip` unmounts on hide. Preserve fade-out with a delayed-unmount
  mode and keep the `placed`-gate that prevents first-frame hops.
- **Hover handoff:** interactive popups must stay mounted while the pointer is
  over the trigger OR the popup, or nested keyword tooltips become unreachable.
- **Nested keyword tooltips:** `pointer-events-none` parent tooltips (enemy
  tooltip) cannot trigger nested keyword tooltips today anyway; only interactive
  popups can. Preserve that behavior.
- **Width parity:** card/gear popups match the trigger's rendered width; other
  tooltips keep authored root-scale widths, with an optional stage-relative
  max-width cap so they cannot dominate small windows.
