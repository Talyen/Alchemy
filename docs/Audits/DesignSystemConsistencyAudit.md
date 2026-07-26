# Design System Consistency Audit

**Goal:** Find custom sizing, layout, typography, and color patterns that diverge from existing shared UI primitives and design tokens, then write a plan to migrate identified custom patterns toward those owners without losing justified game UI.

Prereads: `src/components/ui/README.md`, `src/features/alchemy/shared/ui/README.md`, `src/styles/theme.css` (+ `src/index.css` / `src/styles/*.css` for CSS variables).

## Intent

Inventory custom vs tokenized vs justified-custom, then write a plan to fix all identified issues (breaking into phases if the scope is large). Prefer existing shared primitives and CSS variables. Add a shared token/helper only for at least three current uses, and only when removing call-site surface outweighs the new API; otherwise simplify locally.

**Principles:** one spacing/color scale; delete parallel one-off systems; reuse `src/components/ui` and `shared/ui` before inventing new chrome; don’t invent a second visual language beside the established game UI.

## Hard stops

- Plan scope: write a plan covering all identified issues; break into distinct phases if the scope is large, rather than attempting a single unstructured sweep or full-screen visual redesign.
- Do not rewrite battle battlefield / hand layout unsupervised in one pass — include a scoped migration phase if that is part of the plan.
- Do not replace intentional game juice: combat float text, card fan, Armory drag ghosts, Motion stagger recipes.
- Do not hand-roll buttons/inputs that already exist in `src/components/ui`.

## Triage

| Priority | Cluster                    | Typical signal                                         | Preferred remediation                                       |
| -------- | -------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| 1        | Spacing / padding literals | Raw `p-[13px]` / magic numbers next to existing tokens | Map to theme spacing / shared classes                       |
| 1        | Duplicated chrome          | Same card/frame/badge markup in 3+ files               | Shared UI component                                         |
| 2        | One-off colors             | Raw hex / `rgb()` bypassing CSS variables              | Adopt theme tokens                                          |
| 2        | Typography roles unused    | Ad-hoc font sizes where a shared text style exists     | Adopt shared typography classes                             |
| 3        | Justified custom layout    | Battle hand fan, Armory board packing                  | Extract constants / small helper; **keep** product behavior |
| 3        | Competing size rules       | Multiple undocumented min-widths for the same chrome   | One documented rule in a shared layout helper               |

**Leave alone (justified custom):** fanned battle hand + drag-to-play; Armory drag FSM / packing; combat float motion; health-bar geometry fills; intentional Motion recipes.

**Tie-breakers:** (1) adopt existing tokens over new APIs, (2) visible UI clarity over cosmetic spacing, (3) duplicated constants over one-off sizes, (4) extract/document justified custom over rewriting it.

## Domain rules

Prefer existing shadcn/Radix wrappers, CVA variants, and Tailwind theme variables already used in neighboring files. Surfaces that already pad should not stack double padding. Gesture-driven motion: 1:1 tracking during drag; settle with interruptible springs already used in the feature.

## Probe hints

- **Hardcoded dimensions:** `rg -n 'w-\[[0-9]|h-\[[0-9]|p-\[[0-9]|m-\[[0-9]|text-\[[0-9]' src --type ts`
- **Raw colors (TS/TSX):** `rg -n '#[0-9a-fA-F]{3,8}|rgb\(|hsl\(' src --type ts -g '!*.test.*'`
- **Raw colors (CSS):** `rg -n '#[0-9a-fA-F]{3,8}|rgb\(|hsl\(' src/styles src/index.css`
- **Parallel button/card markup:** custom button-looking `div`/`button` stacks beside existing `Button` / card primitives.
- **Duplicated empty-state / panel chrome:** copy-pasted panel shells — if structural twins dominate, also consider `DuplicateFeatureSurfaceAudit.md`.
- **Inline shadow/border recipes:** repeated one-off shadow stacks where a shared class exists.
