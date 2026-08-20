# 14. State Gravity & Ownership Audit

**Goal:** Pull misplaced rules, persistence, and presentation logic out of gravity wells (fat Zustand stores, controllers, mega-screens) into the owners defined by Architecture — without inventing new hubs.

## Intent

Restore confirmed ownership drift to an existing Architecture owner. Move rather than mirror: migrate callers and tests, then delete forwarding APIs and parallel paths. New managers/stores require a real lifetime boundary and must replace more surface than they add.

## What “state gravity” means here

Agentic coding often drops the next method on the nearest large module. Gravity wells grow until every concern shares one lifetime and one file surface.

| Tell                                                                                         | Why it is a finding                                                                                       |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Combat rules / damage / deck math in screens or controllers                                  | Belongs in `src/lib/battle`                                                                               |
| Save mutation or schema policy in screens                                                    | Belongs in `shared/storage` / `src/lib/validation/save-schemas`                                           |
| Feature navigation and screen-only UI state on persistence types                             | Presentation leaked downward                                                                              |
| `gameplay-state-store` or capability ports growing feature-specific APIs used outside stores | Violates capability containment — use the owning run-session port ([ARCHITECTURE.md](../ARCHITECTURE.md)) |
| Mega-screen that orchestrates rewards, catalog lookups, and mutations                        | Screen owns too many jobs; extract controller/facade or shared UI                                         |
| New `*Manager` / parallel store beside existing owners for one flow                          | Invented gravity well instead of an extension on the real owner                                           |

**Not this audit:** sibling routing — [README.md § Ownership](README.md#ownership).

## Hard stops

- Do not move feature-specific logic out of its feature folder into `shared/ui` or root `src/lib` unless it is genuinely shared across ≥2 feature domains.
- Do not create new Zustand stores for state that belongs in local React component state (`useState`) or is derived on render.
- Do not add React context for run/battle data flow — pass domain data via controller props per [ARCHITECTURE.md](../ARCHITECTURE.md).
- Do not collapse [intentional seams](README.md#intentional-seams-do-not-collapse).
- Do not move presentation into `src/lib` (must stay React-free).
- Repair an obvious one-file ESLint boundary violation directly rather than expanding it into an ownership audit.
- Feature code outside `shared/stores/` must not import `gameplay-state-store` or low-level ports directly — use capability ports (`run-session-*-port`). See [ARCHITECTURE.md](../ARCHITECTURE.md).
- Screens continue to receive run/battle bindings through shell controllers and controller props; do not replace documented bindings with React context or direct store/facade hooks merely to shorten prop flow.

## Evidence bar

- **Misplaced business logic:** pure rules, damage formulas, card resolution, or state transitions implemented inside React screens, shell controllers, or fat Zustand stores instead of pure `src/lib/` modules.
- **Misplaced persistence:** save/load/migration logic embedded in UI components or controllers instead of `shared/storage`.
- **Misplaced presentation logic:** UI rendering, formatting, or motion logic embedded inside core game-engine rules or store actions.

## Remedy preference

Prefer moving pure rules into the matching `src/lib/*` owner and persistence policy into `shared/storage` / save-schemas / migrations, keeping stores thin. Keep run orchestration on shell controllers plus capability-specific run-session ports (lifecycle implemented in `run-transitions.ts`). Keep battle VFX in `battle-presentation-store`, global UI chrome in `ui-store`, meta discovery in `profile-store`, permanent gear in `gear-store`, homestead/talents in `gameplay-state-store.runProfile` ([ARCHITECTURE.md](../ARCHITECTURE.md)). Extract presentation-only helpers into `shared/ui` or the feature folder; collapse duplicate shells via `09-DuplicateFeatureSurfaceAudit.md` when that is the bulk of the win. A pass may move several connected responsibilities out of one gravity well in phases when each destination is already documented and the old APIs disappear; propose only when the split requires a new owner.

## Domain rules

Ownership is defined by [ARCHITECTURE.md](../ARCHITECTURE.md) (aggregate layout, controllers, capability ports, `src/lib` owners) — read the relevant sections there rather than relying on a copied table here. Deltas this audit adds on top:

- **Hub containment:** keep `gameplay-state-store` and persistence modules thin — new work goes to handlers, ports, or controllers, not feature-specific methods on a mixed-lifetime hub.
- **Presentation split:** product screens stay in `meta/` / `run-setup/` / `run-loop/`; shared chrome belongs in `shared/ui` / `src/components/ui`; nothing React lands in `src/lib`.

## Known signals

- **Deep prop drilling:** battle/run props passed through ≥3 levels because controller props or view composition are shaped too broadly; preserve the documented shell-controller binding rather than bypassing it with direct store/facade access.
- **Direct aggregate or port bypasses from screens:** `gameplay-state-store` or low-level port imports under `src/features/alchemy` outside `**/stores/**` instead of capability ports.
- **Other store bypasses:** screens importing `gear-store` / `profile-store` mutation APIs where a facade/controller already owns the write path.
- **Transient UI in persistence types:** hover/selection/scroll fields on save shapes.
- **Misplaced battle math in React:** damage/deck calculations inside `*.tsx` screens.
- **Controller / store bloat:** mega-files mixing navigation, rewards, battle sync, and persistence.
- **Invented parallel hubs:** new `*Manager` / `*Store` beside existing owners for a single flow.
- **Misplaced transforms/selectors:** catalog joins, projections, derived state, or feature adapters live on a screen/store only because it was the nearest large owner.
- **Route and controller glue:** repeated route composition or controller bindings encode feature rules that belong to an existing capability owner.
- **Test ownership gravity:** production-only factories or semantic rules live in test helpers, or tests remain attached to the old owner after a move.
