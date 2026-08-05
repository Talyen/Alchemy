# 11. Inelegant Slop Audit

**Goal:** Find and simplify hotspots of over-engineered, verbose, or un-pragmatic code — from function-level ceremony up to file/folder mass hotspots with mixed jobs — without a whole-repo rewrite.

## Intent

Surface **confirmed** hotspots so authored LOC, declarations, indirection, nesting, mixed responsibilities, or review surface decreases. Moving ceremony among files is not success. Prefer deleting/inlining; bounded structural simplification may ship under [README.md](README.md), while new layers or uncertain ownership remain proposals. A clean pass is valid. Before shipping a fix, confirm real reading/editing cost, no second need for the indirection, and a simpler form that preserves behavior. One severe abstraction or mega-module may qualify without repeated examples. Follow the abstraction through its types, tests, configuration, and call sites when removing only the local wrapper would leave the ceremony intact. If the fix scope is large, phase the plan.

This audit owns two scales: **local ceremony** (functions, wrappers, comments, branches) and **file/folder mass** (large authored surfaces whose size or mixed jobs cost more to read, edit, or verify than the behavior warrants). Wrong Architecture owner — even in a huge file — belongs to `14-StateGravityOwnershipAudit.md`.

## What “slop” means here

Slop looks industrious but fails a pragmatism test: more types, indirection, comments, or branches than the problem warrants.

| Tell                                                                  | Why it is slop                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Interface + single implementer + factory                              | Indirection with no second implementation                                                                                  |
| `*Manager` / `*Helper` / `*Coordinator` / `*Wrapper` for one function | Noun theater around a free function or method                                                                              |
| Narrating comments / restated docs                                    | Rephrases the signature instead of encoding non-obvious intent                                                             |
| Boolean parameter soup                                                | Combinatorial call sites that should be an enum or two functions                                                           |
| Deep nesting / giant component                                        | Complexity that should be extracted _or_ collapsed, not both layered                                                       |
| Pass-through wrappers / rename-only type aliases                      | Extra names that do not add a boundary — reachable twin / no-op shim callers can retarget → `08-DualPathRetentionAudit.md` |
| Premature DI / config objects for 2–3 fields                          | Framework cosplay for a local call                                                                                         |
| Defensive `??` / `as` / `any` stacks without a real failure mode      | Ceremony that hides the real invariant                                                                                     |
| Near-duplicate blocks with tiny diffs                                 | Copy-paste growth instead of one parameterized path                                                                        |
| Complexity > 10 with no domain reason                                 | Branch soup that should be early returns, lookups, or named predicates                                                     |

Elegant code here is usually: plain data, thin Zustand slices, pure `src/lib` rules, shared UI chrome, discriminated unions, and direct call sites.

## File & folder mass hotspots

Mass hotspots are authored production or test surfaces whose size or mixed jobs cost more than the behavior warrants: mixed-job mega-modules (navigation + rewards + persistence + presentation in one file), folder-level parallel scaffolding without distinct product jobs, or harness-heavy test support whose LOC dwarfs unique assertions (hand portfolio fit to `17-UnitTestAudit.md` / `10-E2ETestQualityAudit.md`).

**Evidence bar** (all must hold):

- **Hotspot:** large relative to 2–3 peer files in the same owner class (screen / store / `src/lib` / test support), or routinely forces unrelated code prereads because of mixed jobs
- **Avoidable cause:** mixed jobs, parallel scaffolding, or accumulated helpers without a second need — not inherent domain density
- **Existing home:** a `src/lib` owner, store slice / facade method, shell controller, `shared/ui` shell, or existing test owner can absorb the split or collapse
- **Measurable direction:** net authored LOC, declarations, indirection, nesting, mixed responsibilities, or required review surface decreases while behavior and required coverage stay intact. Architecture-expected ownership splits may be LOC-neutral or slightly positive only when work moves into **existing** owners, the hotspot and coupling shrink, and no parallel path remains

File length alone is a candidate signal, never a finding. Historical churn (`git log` LOC rates, blame) may surface candidates but is not confirming evidence. Do not invent repo-wide LOC thresholds or CI ratchets.

## Hard stops

- Do not collapse intentional seams: battle RNG injection, persistence write coalescing, design-system tokens, asset/codegen boundaries, or ESLint import rules.
- Do not rewrite battle pipeline math “for clarity” without tests proving equivalence.
- Do not turn this into a style-only rename sweep, docs rewrite, or mass delete of tests that encode real invariants.
- Prefer the owning audit when the hit is primarily dead code, reachable dual paths / shims (`08-DualPathRetentionAudit.md`), boundaries, async races, type-safety escapes, duplicate feature surfaces, or state-ownership drift.
- Do not split a function that already reads cleanly at complexity ≤ 10. Complexity p90 ≤ 6 is directional via `npm run audit:all`, not a CI gate.
- Skip load-bearing complexity and allowlisted density: generated assets, battle damage/turn pipeline math, save wire format / normalizer invariants that must stay co-located, intentional controller composition, `screen-routes/` composition tables, intentional Armory drag FSM / battle presentation / Motion juice, and large authored catalogs under `src/lib/game-data` when the job _is_ the catalog.
- Do not hand-edit generated output (`assets.generated.ts`, `metadata.generated.ts`, other sync products), `dist/`, or build artifacts; exclude them from mass inventory and fix sources + regenerate instead.

## Remedy preference

Prefer delete unused ceremony, then inline single-use wrappers, then collapse duplicates in-module. Extract only when a name removes nesting and has ≥2 call sites or clear domain meaning. Move shared chrome into `shared/ui` / `src/components/ui`, or rules into `src/lib` — never a new layer for one call site. Judge structural fixes by simplified ownership and reading/editing cost, not LOC alone.

## Known signals

Optional discovery aids — choose your own probes.

- **Complexity & length:** ESLint `complexity` / `max-lines-per-function` (also via `npm run audit:all`); do not split clean ≤10 functions.
- **Outlier file size:** authored `.ts` / `.tsx` files large relative to peers in the same owner class (candidate only — confirm mixed jobs and an existing home).
- **Mixed-job mega-modules:** one file owning navigation + rewards + persistence + presentation, or schema + migration + UI bindings together.
- **Folder scaffolding mass:** many near-identical helpers under one feature folder without distinct product jobs.
- **Ceremony naming:** `Manager` / `Helper` / `Coordinator` / `Wrapper` / `Factory` nouns around one function.
- **Deep nesting:** >3 nested levels in hot files where early returns would suffice.
- **Defensive cast stacks:** `as unknown as`, nested `??`, optional chains that paper over missing validation.
- **Single-use abstractions:** `npm run audit:single-use` (unused API narrowing primarily owned by `05-DeadCodeAudit.md`).
- **Names & React shape:** domain vocabulary already used in the module; explicit Props types; plain function components.
