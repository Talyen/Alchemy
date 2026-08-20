# 06. Design System Consistency Audit

**Goal:** Find visual and interaction-state patterns that diverge from existing shared UI primitives, semantic roles, and design tokens, then migrate coherent surface families toward those owners without losing justified game UI.

Token / primitive owners: `src/components/ui/README.md`, `src/features/alchemy/shared/ui/README.md`, `src/styles/theme.css` (+ `src/index.css` / `src/styles/*.css` for CSS variables).

## Intent

Compare custom, tokenized, and justified-custom implementations across a complete UI family, then migrate confirmed drift to existing primitives and CSS variables. Add a token/helper only when it meets the shared abstraction bar in [README.md](README.md) and removes more call-site surface than it adds.

**Principles:** one spacing/color scale; delete parallel one-off systems; reuse `src/components/ui` and `shared/ui` before inventing new chrome; don’t invent a second visual language beside the established game UI.

## Hard stops

- Do not rewrite battle battlefield / hand layout unsupervised in one pass — include a scoped migration phase if that is part of the plan.
- Do not replace intentional game juice: combat float text, card fan, Armory drag ghosts, Motion stagger recipes.
- Do not hand-roll buttons/inputs that already exist in `src/components/ui`.
- Do not stop a coherent migration at one literal when sibling surfaces implement the same semantic role; inspect and, when justified, migrate the complete family.

## Triage

| Priority | Cluster                    | Typical signal                                                                           | Preferred remediation                                       |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1        | Spacing / padding literals | Raw `p-[13px]` / magic numbers next to existing tokens                                   | Map to theme spacing / shared classes                       |
| 1        | Duplicated chrome          | Same card/frame/badge markup in 3+ files                                                 | Shared UI component                                         |
| 2        | One-off colors             | Raw hex / `rgb()` bypassing CSS variables                                                | Adopt theme tokens                                          |
| 2        | Typography roles unused    | Ad-hoc font sizes where a shared text style exists                                       | Adopt shared typography classes                             |
| 3        | Justified custom layout    | Battle hand fan, Armory board packing                                                    | Extract constants / small helper; **keep** product behavior |
| 3        | Competing size rules       | Multiple undocumented min-widths for the same chrome                                     | One documented rule in a shared layout helper               |
| 2        | State-role drift           | Focus, disabled, error, selected, or loading states disagree across one component family | Adopt the existing semantic variant or primitive            |
| 2        | Responsive / motion drift  | Same surface family changes density, breakpoint, or transition behavior inconsistently   | Consolidate under the established responsive or motion role |

**Leave alone (justified custom):** fanned battle hand + drag-to-play; Armory drag FSM / packing; combat float motion; health-bar geometry fills; intentional Motion recipes.

**Tie-breakers:** (1) adopt existing tokens over new APIs, (2) visible UI clarity over cosmetic spacing, (3) duplicated constants over one-off sizes, (4) extract/document justified custom over rewriting it.

## Domain rules

Prefer existing shadcn/Radix wrappers, CVA variants, and Tailwind theme variables already used in neighboring files. Surfaces that already pad should not stack double padding. Gesture-driven motion: 1:1 tracking during drag; settle with interruptible springs already used in the feature.

## Known signals

- **Hardcoded dimensions:** arbitrary Tailwind size literals (`w-[…]`, `h-[…]`, `p-[…]`, `m-[…]`, `text-[…]`) beside existing tokens.
- **Raw colors (TS/TSX):** hex / `rgb(` / `hsl(` bypassing CSS variables.
- **Raw colors (CSS):** same patterns under `src/styles` / `src/index.css`.
- **Parallel button/card markup:** custom button-looking `div`/`button` stacks beside existing `Button` / card primitives.
- **Duplicated empty-state / panel chrome:** copy-pasted panel shells — if structural twins dominate, also consider `09-DuplicateFeatureSurfaceAudit.md`.
- **Inline shadow/border recipes:** repeated one-off shadow stacks where a shared class exists.
- **Semantic state drift:** parallel controls render focus, selected, disabled, loading, or error states with incompatible roles.
- **Responsive and motion roles:** sibling surfaces use conflicting breakpoints, densities, easing, or durations where an established role exists.
- **Icon treatment:** inconsistent size, alignment, stroke, or label spacing for the same action family.
