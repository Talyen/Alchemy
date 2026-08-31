# Design system primitives

Generic visual primitives built with Tailwind and Radix UI.

Placement rules (including the `ui-store` exception for game widgets): [`shared/ui/README.md`](../../features/alchemy/shared/ui/README.md).

## Invariants

- **Zero game-domain knowledge:** Primitives must not import `@/features` or subscribe to run, battle, homestead, alchemist, or profile stores. Domain data is passed strictly via props.
- **Accessibility:** Interactive controls adhere to standard ARIA semantics (`role="progressbar"`, `role="switch"`, `aria-checked`, `aria-valuenow`, keyboard navigation).
- **React 19:** Function components receive `ref` directly as a prop; Radix composition uses `Slot` with `asChild`.

## Primitives Catalog

- `Button` (`button.tsx`): Primary, destructive, outline, and ghost action buttons supporting CVA variants, sizes (`sm`, `default`, `lg`, `icon`), optional `wrapperClassName`, and Radix `asChild` composition.
- `Progress` (`progress.tsx`): Accessible progress indicator supporting sizing (`sm`, `md`), color classes, custom fill styles, value clamping, and standard ARIA progressbar roles.
- `Select` (`select.tsx`): Radix-powered dropdown select composed of `Select`, `SelectValue`, `SelectTrigger`, `SelectContent`, and `SelectItem`.
- `ShineBorder` (`shine-border.tsx`): Radial gradient shine border effect for high-tier loot, keyword affinities, and active cards. Supports multi-stop palettes and CSS variables.
- `Switch` (`switch.tsx`): Accessible toggle switch with animated thumb slider and synchronized `aria-checked` and disabled states.
- `TextAnimate` (`text-animate.tsx`): Motion-powered staggered text reveal for narrative dialogs and event introductions.
