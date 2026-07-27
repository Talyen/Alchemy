# State Gravity & Ownership Audit

**Goal:** Pull misplaced rules, persistence, and presentation logic out of gravity wells (fat Zustand stores, controllers, mega-screens) into the owners defined by Architecture — without inventing new hubs.

## Intent

Identify ownership-drift clusters and restore them to existing owners. Move, do not mirror: delete old forwarding APIs, parallel paths, and duplicate tests. New managers/stores must express a real lifetime boundary and replace more surface than they add. Significant moves remain proposals per [README.md](README.md). Before shipping, confirm the code’s concern matches a different Architecture owner, real review/test cost from mixed jobs, and an existing home (not a greenfield layer). If the scope is large, phase the plan.

## What “state gravity” means here

Agentic coding often drops the next method on the nearest large module. Gravity wells grow until every concern shares one lifetime and one file surface.

| Tell                                                                  | Why it is a finding                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Combat rules / damage / deck math in screens or controllers           | Belongs in `src/lib/battle`                                       |
| Save mutation or schema policy in screens                             | Belongs in `shared/storage` / `src/lib/validation/save-schemas`   |
| Feature navigation and screen-only UI state on persistence types      | Presentation leaked downward                                      |
| `run-domain-store` growing feature-specific APIs used outside stores  | Violates facade containment — use `run-session-facade`            |
| Mega-screen that orchestrates rewards, catalog lookups, and mutations | Screen owns too many jobs; extract controller/facade or shared UI |
| New `*Manager` / parallel store beside existing owners for one flow   | Invented gravity well instead of an extension on the real owner   |

**Not this audit:** import-gate failures alone → fix via ESLint; unused APIs → `DeadCodeRatioAudit.md`; verbose ceremony with correct ownership → `InelegantSlopAudit.md`; duplicate screens with correct owners → `DuplicateFeatureSurfaceAudit.md`; silent save bugs without ownership drift → `BehaviorHardeningAudit.md`.

## Hard stops

- Do not collapse intentional seams: battle RNG injection, persistence write coalescing, asset/codegen boundaries, `lib` vs `features` split.
- Do not move presentation into `src/lib` (must stay React-free).
- Repair an obvious one-file ESLint boundary violation directly rather than expanding it into an ownership audit.
- Feature code outside `shared/stores/` must not import `run-domain-store` directly — use the facade.

## Remedy preference

Prefer moving pure rules into the matching `src/lib/*` owner and persistence policy into `shared/storage` / save-schemas / migrations, keeping stores thin. Keep run orchestration on shell controllers + `run-session-facade` / `run-transitions.ts`. Keep battle VFX in `battle-presentation-store`, global UI chrome in `ui-store`, meta discovery in `app-store`, permanent gear in `gear-store`. Extract presentation-only helpers into `shared/ui` or the feature folder; collapse duplicate shells via `DuplicateFeatureSurfaceAudit.md` when that is the bulk of the win. Propose hub splits when local moves would leave the same gravity well intact.

## Domain rules

Follow Architecture ownership:

| Concern                     | Owner                                               |
| --------------------------- | --------------------------------------------------- |
| Battle rules / effects      | `src/lib/battle`, effect handlers                   |
| Content definitions         | `src/lib/game-data`                                 |
| Gear rules                  | `src/lib/gear`                                      |
| Homestead / content systems | `src/lib/homestead`, `src/lib/content-systems`      |
| Save graph, Zod, migrations | `shared/storage`, `src/lib/validation/save-schemas` |
| Run domain slices           | `run-domain-store` (stores layer only)              |
| Permanent gear inventory    | `gear-store`                                        |
| Meta discovery / compendium | `app-store`                                         |
| Battle VFX (ephemeral)      | `battle-presentation-store`                         |
| Global UI chrome            | `ui-store`                                          |
| Feature read/write API      | `run-session-facade`                                |
| Lifecycle                   | `run-transitions.ts`                                |
| Controllers                 | `shell/use-*-controller.ts`                         |
| Product screens             | `meta/`, `run-setup/`, `run-loop/`                  |
| Shared chrome               | `shared/ui`, `src/components/ui`                    |

**Hub containment:** keep `run-domain-store` and persistence modules thin — new work goes to handlers, slices, facade methods, or controllers, not feature-specific methods on the hub.

## Known signals

Optional discovery aids — choose your own probes.

- **Deep prop drilling:** battle/run props passed through ≥3 levels where a facade hook or controller binding already exists.
- **Direct domain-store imports from screens:** `run-domain-store` imports under `src/features/alchemy` outside `**/stores/**`.
- **Other store bypasses:** screens importing `gear-store` / `app-store` mutation APIs where a facade/controller already owns the write path.
- **Transient UI in persistence types:** hover/selection/scroll fields on save shapes.
- **Misplaced battle math in React:** damage/deck calculations inside `*.tsx` screens.
- **Controller / store bloat:** mega-files mixing navigation, rewards, battle sync, and persistence.
- **Invented parallel hubs:** new `*Manager` / `*Store` beside existing owners for a single flow.
