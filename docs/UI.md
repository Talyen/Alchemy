# UI system

Canonical owner for UI placement, primitives, interaction, motion, tooltips, and
Alchemy's accessibility stance. Screen wiring checklists remain in
[WORKFLOWS.md](./WORKFLOWS.md#adding-a-new-screen); Armory-specific interaction
rules remain in [ARMORY.md](./ARMORY.md).

## Placement and boundaries

- `src/components/ui/` owns generic Tailwind/Radix primitives with no game-domain knowledge. These components receive domain data through props and do not import `@/features` or subscribe to gameplay stores.
- `src/features/alchemy/shared/ui/` owns reusable game widgets such as cards, choice buttons, status icons, actor panels, shop slots, and map nodes. They receive run, battle, and session data through props. Presentation-only `ui-store` state is allowed.
- Screens and feature-local presentation stay with their owning feature until at least two feature domains need the same widget.
- Static catalogs used by shared game widgets come from `shared/config/game-data-catalog.ts`, not the token `config/` barrel.

Use `ScreenShell`, `TitledScreenShell`, `ScreenHeader`, and `PageLayout` for page structure. Use shared chrome before recreating buttons, progress bars, switches, cards, or tooltips.

## Component conventions

- Use plain prop functions rather than `React.FC`; React 19 components receive `ref` directly as a prop.
- Use `cn()` for conditional classes and existing CVA variants for semantic states.
- Generic interactive primitives preserve standard ARIA roles, names, values, keyboard behavior, and disabled states.
- `Surface` is the shared interactive card/tile owner. `PortaledTooltip` with `TooltipPanel` owns tooltip chrome. `ShineText`, `GearItemTitle`, and `TrinketItemTitle` own keyword/item shine typography.
- Modals and panels use `useModalEscapeDismiss` or `useCaptureEscapeCancel` so the global Escape stack remains ordered.

## Screen fade motion

| Concern            | Contract                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route change       | `useRenderedScreenTransition` owns the opacity-only page fade. Autosave, audio, battle playback, and presentation teardown follow committed `screen`, not `renderedScreen`.                                                     |
| In-screen identity | Use `FadeSlot` for tabs, shop modes, offerings, keyword trees, and other identity swaps. Its first mount is idle so it does not stack on the route fade.                                                                        |
| Overlays           | Dialogs, wish, and the game menu use `useFadePresence` so exit completes before unmount.                                                                                                                                        |
| Copy               | `ScreenDescription` is static. `TextAnimate` is reserved for mystery narrative.                                                                                                                                                 |
| Anti-flash         | Replace outgoing payloads only at the rendered-screen commit, swap layout while opacity is zero, reserve height for shape-changing swaps, and keep shell chrome mounted when payload data clears. Do not stagger route content. |

Motion tokens live in `src/lib/game-constants/ui-motion.ts` (`MOTION_FADE_MS`, `TOOLTIP_FADE_MS`) and are mirrored to CSS as `var(--motion-fade-duration)` in `src/styles/theme.css` / `src/styles/components.css`. Keep JS `MOTION_FADE_MS` and CSS `var(--motion-fade-duration)` in sync; `npm run lint:architecture-smoke` asserts this.

## Buttons and interactive surfaces

Tokens live in `src/features/alchemy/shared/config/button-tokens.ts`.

| Concern        | Standard                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| Shape          | `rounded-xl` rectangles through `BUTTON_SHAPE`                                          |
| Primary        | `Button variant="primary"` for Play, Continue, and Confirm                              |
| Secondary      | `Button variant="outline"` for Back, Cancel, Skip, and alternate navigation             |
| Accent         | `ShineAccentButton` only for accent-intent forward actions                              |
| Paired actions | `ActionButtonRow`, secondary left and primary right                                     |
| Equal choices  | `DestinationChoices` and `Surface`, with an accessible tile name                        |
| Tabs           | `TabBar`                                                                                |
| Hover / press  | Shared CSS hover scale and `active:` feedback; do not add parallel Motion hover scaling |

## Hover tooltips

Tooltips render through `PortaledTooltip` into the root-space `#tooltip-root`.
Placement is bounded to `[data-testid="vr-stage"]` with `documentElement` as a
fallback, so panels keep a constant CSS-pixel scale and avoid clipped ancestors.
Prefer above, flip below when needed, and use the roomier side when neither
vertical gutter fits.

- Drive ordinary hover with `useHoverVisible()` and `triggerRef`. For card/tile grids that already track hover via `useInteractiveCard`, use the `holdMs: TOOLTIP_FADE_MS` form or the thin alias `useTileHoverPopup` (see those hooks for the exact call shape).
- Use `placement="side-start"` or `"side-end"` for explicitly side-anchored panels.
- Use `maxWidthFraction` for small-window bounds.
- Tooltip panels are `pointer-events-none`; nested interactive tooltips are unsupported.
- State-driven triggers mount the portal only while hovered; exit fades complete via the shared `TOOLTIP_FADE_MS` hold — do not double-hold.
- Fade primitives are consolidated in `src/features/alchemy/shared/ui/use-fade.tsx`; placement helpers live in `portaled-tooltip-placement.ts`, content slots in `tooltip-panel.tsx`.

## Accessibility stance

Alchemy is visual-heavy and intentionally ships no dedicated accessibility
feature set beyond semantic robustness. Preserve semantic buttons,
programmatic names and states, keyboard behavior supplied by shared primitives,
and `aria-hidden` on decorative art. Do not add focus traps/restoration,
screen-reader announcement systems, contrast tooling, or per-component
reduced-motion variants without a product decision. The global
`prefers-reduced-motion` block in `src/styles/keyframes.css` is the sole motion
accommodation.

## Verification

Use the changed-path route in [CONTRIBUTING.md](../CONTRIBUTING.md). Interaction
or browser-journey work also follows [tests/e2e/README.md](../tests/e2e/README.md).
