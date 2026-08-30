# UI placement

Game-domain widgets live in `src/features/alchemy/shared/ui/`. Generic design-system primitives live in [`src/components/ui/`](../../../../components/ui/README.md).

- **`shared/ui`:** cards, choice buttons, status icons, actor panels, shop slots, map nodes. Receive run/battle/session data via **props**. Do not subscribe to those stores. **`ui-store` is allowed** (hover/shimmer and other presentation-only chrome). Static catalogs (`cardLibrary`, `keywordDefinitions`, unlock copy) come from [`shared/config/game-data-catalog.ts`](../config/game-data-catalog.ts), not the token `config/` barrel.
- **`src/components/ui`:** Tailwind/Radix primitives with no game logic. Must not import `@/features` or know run, battle, homestead, or alchemist stores. Pass domain state via props.
- **Screen Shells & Layouts:** Use `ScreenShell`, `TitledScreenShell`, `ScreenHeader`, and `PageLayout` from `layout-components.tsx` for consistent page structures.
- **Popups & Tooltips:** Use `PortaledTooltip` with `TooltipPanel` for DOM-portal tooltips with automatic edge clamping and stage collision avoidance.
- **Surface & Cards:** Use `Surface` for interactive cards and tiles with standard hover scaling, shimmer slots, and keyboard accessibility.
- **Modals & Escape Stack:** Modals and panels integrate with the global escape stack via `useModalEscapeDismiss` or `useCaptureEscapeCancel`.
- **Shine & Visual Effects:** Use `ShineText`, `GearItemTitle`, and `TrinketItemTitle` for keyword/item shine typography.
- Shared chrome first; do not recreate `Button`, progress bars, or switches inside `shared/ui`.
