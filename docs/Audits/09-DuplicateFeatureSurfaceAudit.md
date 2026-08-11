# 09. Duplicate Feature Surface Audit

**Goal:** Collapse near-duplicate React product surfaces — copied screens, shells, modals, pickers, and summary grids — into one parameterized owner without inventing a new UI framework.

## Intent

Collapse confirmed structural twins under an existing owner. Two substantial twins qualify when that owner can absorb them cleanly; otherwise require three, or two with demonstrated drift. Include their loading, empty, error, overlay, and responsive states when those form the same family; do not build a generic renderer merely because two callers exist.

## What counts as a duplicate surface

Duplicate surfaces look like parallel product screens that differ mainly by labels, catalogs, or bindings — not by interaction model.

| Tell                                                         | Why it is a finding                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Parallel meta / run-loop screens with the same section stack | Agents copied a shell instead of parameterizing mode/content |
| Near-identical detail / summary / picker layouts             | Same grid, chrome, and empty states with tiny diffs          |
| Repeated reward / outcome / card-grid wrappers               | Shell already exists (or should) under `shared/ui`           |
| Same modal / overlay scaffolding in 3+ files                 | Layout ownership belongs in one helper, not N call sites     |
| Diverged twins that used to match                            | Copy-paste drift — bugs get fixed in one sibling only        |

**Not this audit:** single-file ceremony or single-path authored mass → `11-InelegantSlopAudit.md`; raw spacing/color literals → `06-DesignSystemConsistencyAudit.md`; unused symbols → `05-DeadCodeAudit.md`; logic living in the wrong layer → `14-StateGravityOwnershipAudit.md`; retained parallel live implementations outside product UI → `08-DualPathRetentionAudit.md`.

## Hard stops

- Do not introduce a generic "UI builder", dynamic form schema engine, or generic component registry to collapse two or three screens.
- Do not move feature-specific code into `src/features/alchemy/shared/ui/` unless it is used by at least two distinct feature domains.
- Do not flatten intentional variants that serve distinct product roles (e.g. reward card selection vs deck inventory viewer).

## Evidence bar

- **Two or more product UI surfaces** (components, screens, modal dialogs, drawers, control clusters) with near-identical markup, layout, state management, and interaction flow.
- A single parameterized component or shared sub-component can replace the duplicates without introducing complex conditional branching (more than 2-3 simple props).

## Remedy preference

Prefer delete the weaker twin when one path is strictly redundant, then parameterize in place under the existing feature folder. Move shared product UI into `src/features/alchemy/shared/ui/` when ≥2 feature folders need it. Adopt shared UI primitives / tokens for chrome duplication — route pure token work through `06-DesignSystemConsistencyAudit.md` when that is the whole fix. A bounded shared shell may ship when ownership and behavior are already established; propose only when the shell creates a new product model or architectural seam.

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
- **State-family duplication:** sibling screens repeat loading, empty, error, overlay, responsive, and controller glue around otherwise parallel content.
