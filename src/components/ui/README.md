# Design System / UI Primitives

This directory contains framework-agnostic visual primitives, design system components, and base styling widgets (e.g. Tailwind-based, Radix-based, or MagicUI widgets).

### Guidelines

- **Framework and Style Primitives only**: Keep components in this folder generic and reusable across different feature domains.
- **No Game Domain Logic**: Components here must not import from `features/` or have knowledge of run, battle, alchemist, or homestead stores.
- **Use Props**: Always pass feature and domain state via React props.
