# Duplicate Feature Surface Audit

**Goal:** Collapse near-duplicate React product surfaces — copied screens, shells, modals, pickers, and summary grids — into one parameterized owner without inventing a new UI framework.

## Intent

Find cohesive clusters of **confirmed** copy-paste feature surfaces and collapse them under their existing owners. Require three structural twins, or two with demonstrated drift/duplicate maintenance. A successful collapse removes the old paths and reduces net LOC/declarations; do not build a generic configuration surface for two callers. Before shipping, confirm structural twinship, maintenance cost across siblings, and a safer shared shape that preserves behavior. If the scope across features is large, phase the plan.

## What counts as a duplicate surface

Duplicate surfaces look like parallel product screens that differ mainly by labels, catalogs, or bindings — not by interaction model.

| Tell                                                         | Why it is a finding                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Parallel meta / run-loop screens with the same section stack | Agents copied a shell instead of parameterizing mode/content |
| Near-identical detail / summary / picker layouts             | Same grid, chrome, and empty states with tiny diffs          |
| Repeated reward / outcome / card-grid wrappers               | Shell already exists (or should) under `shared/ui`           |
| Same modal / overlay scaffolding in 3+ files                 | Layout ownership belongs in one helper, not N call sites     |
| Diverged twins that used to match                            | Copy-paste drift — bugs get fixed in one sibling only        |

**Not this audit:** single-file ceremony → `InelegantSlopAudit.md`; raw spacing/color literals → `DesignSystemConsistencyAudit.md`; unused symbols → `DeadCodeRatioAudit.md`; logic living in the wrong layer → `StateGravityOwnershipAudit.md`; retained parallel live implementations outside product UI → `DualPathRetentionAudit.md`; single-path authored mass → `AuthoredMassHotspotAudit.md`.

## Hard stops

- Do not force unrelated product flows into one component (e.g. battle hand vs collection grid) just because both show cards.
- Do not move shared chrome into a feature folder when it already belongs in `shared/ui` or `src/components/ui`, or domain rules into screens.
- Prefer the owning audit when the hit is primarily dead code, slop ceremony, token adoption, or state ownership.

## Remedy preference

Prefer delete the weaker twin when one path is strictly redundant, then parameterize in place under the existing feature folder. Move shared product UI into `src/features/alchemy/shared/ui/` when ≥2 feature folders need it. Adopt shared UI primitives / tokens for chrome duplication — route pure token work through `DesignSystemConsistencyAudit.md` when that is the whole fix. Propose a larger shared shell when local parameterization would leave the same twins nearby.

## Domain rules

Ownership follows [ARCHITECTURE.md](../ARCHITECTURE.md):

| Surface kind                                              | Prefer owner                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| App-wide cards, detail panes, keyword text                | `shared/ui` or `src/components/ui`                                             |
| Cross-run shells (reward reveal, shared encounter chrome) | `shared/ui` or the dominant run-loop owner                                     |
| Design tokens / button primitives                         | existing UI README owners / Tailwind tokens                                    |
| Mode-specific content bindings                            | Stay in `meta/`, `run-setup/`, or `run-loop/`; pass data into the shared shell |

Keep intentional product differences (mystery vs shop rules, labyrinth vs destination progression; battle hand vs Armory/collection card grids). Collapse only the **view scaffolding** and repeated presentation — do not force battle hand and collection grids into one component just because both show cards.

## Known signals

Optional discovery aids — choose your own probes.

- **Parallel screen shells:** screens under `meta/`, `run-setup/`, and `run-loop/` with identical layout chrome and different data bindings.
- **Empty-state duplication:** repeated empty collection/inventory/shop placeholders.
- **Card / grid scaffolding:** near-identical card grids, pickers, and list wrappers across features.
- **Modal / overlay twins:** duplicated confirm dialogs, portals, and backdrop dismiss patterns.
- **Reward / outcome wrappers:** parallel post-battle or claim-reward presentation shells.
