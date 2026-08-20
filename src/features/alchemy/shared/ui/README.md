# UI placement

Game-domain widgets live in `src/features/alchemy/shared/ui/`. Generic design-system primitives live in `src/components/ui/`.

- **`shared/ui`:** cards, choice buttons, status icons, actor panels, shop slots, map nodes. Receive run/battle/session data via **props**. Do not subscribe to those stores. **`ui-store` is allowed** (hover/shimmer and other presentation-only chrome).
- **`src/components/ui`:** Tailwind/Radix primitives with no game logic. Must not import `@/features` or know run, battle, homestead, or alchemist stores. Pass domain state via props.
- Shared chrome first; do not recreate `Button`, progress bars, or switches inside `shared/ui`.
