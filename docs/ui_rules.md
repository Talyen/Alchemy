# UI Layout Reliability Rules

These rules are mandatory for all UI in this repository.

## 1) Layout Constraints
- Use container-based layout only.
- Use Flexbox or Grid for primary layout structure.
- Do not use absolute/fixed positioning for primary layout flow.
- Absolute/fixed positioning is allowed only for overlays and effects (tooltips, modals, combat numbers) and must be annotated with `/* ui-allow-absolute */` in source.
- Every layout container must size relative to parent with responsive constraints (`w-full`, `max-w-*`, `min-h-*`, `flex-1`, `grid-cols-*`) rather than hard-coded viewport offsets.

## 2) Spacing System
- Use a consistent 4px spacing scale.
- Tailwind spacing values should map to 4px multiples (`p-1`, `p-2`, `gap-3`, etc.).
- Do not use ad-hoc pixel margins/padding in inline styles.

## 3) Responsiveness
UI must render correctly at:
- Small: 800x600
- Medium: 1280x720
- Large: 1920x1080

Requirements:
- No clipped critical controls.
- Primary actions remain visible without horizontal scrolling.
- Content stacks/reflows using container rules.

## 4) Visibility Guarantees
- No element may overflow its intended parent container.
- Text must wrap (`break-words` / `whitespace-normal`) and never spill outside UI cards.
- Images and media must fit parent (`max-w-full`, `h-auto`, `object-contain` as appropriate).
- Hidden debug-only elements must use an explicit toggle, not accidental zero-size/opacity state.

## 5) Alignment
- Use explicit alignment (`items-*`, `justify-*`, `self-*`, `content-*`).
- Avoid manual pixel nudging (`left`, `top`, `transform: translate(...)`) for baseline layout.

## 6) Accessibility Constraints
- Click/touch targets must be at least 44x44 CSS pixels.
- Ensure visible hierarchy: heading, secondary text, interactive controls.
- Interactive elements must preserve sufficient contrast and focus visibility.

## 7) Debug Compatibility
All UI must be compatible with UI debug mode.
- Containers should include `data-ui-container` or use primitives that add it.
- Important UI boxes should include `data-ui-boundary`.
- Debug mode must visually show layout boundaries and overflow risk.

## 8) Primitive-First Policy
- New UI should be composed from primitives in `src/ui/primitives`.
- Avoid raw layout wrappers unless a primitive cannot express the pattern.
- If a primitive gap is found, extend primitives first, then build feature UI.

## 9) Enforcement
- Static guardrails run during development via Vite plugin checks.
- Runtime diagnostics report overlap/overflow/out-of-screen warnings in development.
- Violations must be resolved before merging UI changes.
