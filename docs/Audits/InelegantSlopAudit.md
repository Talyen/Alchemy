# Inelegant Slop Audit

**Goal:** Find and simplify hotspots of over-engineered, verbose, or un-pragmatic code — especially agent-produced “slop” — without a whole-repo rewrite.

## Intent

Surface **confirmed** hotspots so authored LOC, declarations, indirection, or nesting decreases. Moving ceremony among files is not success. Prefer deleting/inlining; significant structural work remains a proposal per [README.md](README.md). A clean pass is valid. Before shipping a fix, confirm real reading/editing cost, no second need for the indirection, and a shorter local form that preserves behavior. If the fix scope is large, phase the plan.

## What “slop” means here

Slop looks industrious but fails a pragmatism test: more types, indirection, comments, or branches than the problem warrants.

| Tell                                                                  | Why it is slop                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Interface + single implementer + factory                              | Indirection with no second implementation                              |
| `*Manager` / `*Helper` / `*Coordinator` / `*Wrapper` for one function | Noun theater around a free function or method                          |
| Narrating comments / restated docs                                    | Rephrases the signature instead of encoding non-obvious intent         |
| Boolean parameter soup                                                | Combinatorial call sites that should be an enum or two functions       |
| Deep nesting / giant component / god file                             | Complexity that should be extracted _or_ collapsed, not both layered   |
| Pass-through wrappers / rename-only type aliases                      | Extra names that do not add a boundary                                 |
| Premature DI / config objects for 2–3 fields                          | Framework cosplay for a local call                                     |
| Defensive `??` / `as` / `any` stacks without a real failure mode      | Ceremony that hides the real invariant                                 |
| Near-duplicate blocks with tiny diffs                                 | Copy-paste growth instead of one parameterized path                    |
| Complexity > 10 with no domain reason                                 | Branch soup that should be early returns, lookups, or named predicates |

Elegant code here is usually: plain data, thin Zustand slices, pure `src/lib` rules, shared UI chrome, discriminated unions, and direct call sites.

## Hard stops

- Do not collapse intentional seams: battle RNG injection, persistence write coalescing, design-system tokens, asset/codegen boundaries, or ESLint import rules.
- Do not rewrite battle pipeline math “for clarity” without tests proving equivalence.
- Do not turn this into a style-only rename sweep, docs rewrite, or mass delete of tests that encode real invariants.
- Prefer the owning audit when the hit is primarily dead code, boundaries, async races, type-safety escapes, duplicate feature surfaces, or state-ownership drift.
- Do not split a function that already reads cleanly at complexity ≤ 10. Complexity p90 ≤ 6 is directional via `npm run audit:all`, not a CI gate.
- Skip load-bearing complexity (generated assets, damage pipeline, save wire format, intentional controller composition).

## Remedy preference

Prefer delete unused ceremony, then inline single-use wrappers, then collapse duplicates in-module. Extract only when a name removes nesting and has ≥2 call sites or clear domain meaning. Move shared chrome into `shared/ui` / `src/components/ui`, or rules into `src/lib` — never a new layer for one call site.

## Known signals

Optional discovery aids — choose your own probes.

- **Complexity & length:** ESLint `complexity` / `max-lines-per-function` (also via `npm run audit:all`); do not split clean ≤10 functions.
- **Ceremony naming:** `Manager` / `Helper` / `Coordinator` / `Wrapper` / `Factory` nouns around one function.
- **Deep nesting:** >3 nested levels in hot files where early returns would suffice.
- **Defensive cast stacks:** `as unknown as`, nested `??`, optional chains that paper over missing validation.
- **Single-use abstractions:** `npm run audit:single-use` (unused API narrowing primarily owned by `DeadCodeRatioAudit.md`).
- **Names & React shape:** domain vocabulary already used in the module; explicit Props types; plain function components.
