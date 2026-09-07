# Simplification Audit

Merges the former Change Locality & Context Efficiency (04), Dead Code (05), Dual-Path Retention (08), Duplicate Feature Surface (09), Inelegant Slop (11), and State Gravity & Ownership (14) audits.

**Goal:** Make the code easier to understand and change safely by removing obsolete work, duplicated policy, and misplaced responsibilities. Reduced surface is useful when it reduces maintenance cost; concise code is not an end in itself.

## Scope map

| Sub-scope          | Owns                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dead code          | Zero-consumer symbols, unreachable branches, exhausted flags, orphaned registrations/support files                                                                      |
| Dual paths         | Reachable twins, forwarding shims, closed-window migration bridges, permanent both-branches flags                                                                       |
| Duplicate surfaces | Near-identical screens/shells/modals/pickers differing mainly by labels or bindings                                                                                     |
| Slop               | Ceremony: single-implementer interfaces, noun-theater wrappers, narrating comments, nesting/complexity without domain reason; file/folder mass hotspots with mixed jobs |
| Ownership gravity  | Rules/persistence/presentation stuck in stores, controllers, or mega-screens away from their architecture owner                                                         |
| Change locality    | Recurring changes that force unrelated edits, context, verification, or output                                                                                          |

Sibling routing: async/lifetime → RuntimeCorrectness; type escapes → TypeSafety; token/style-only drift → UIConsistency; test portfolio fit → TestQuality.

## Hard stops

- Do not weaken tests/gates/diagnostics/generated-output checks; do not hand-edit generated output — fix sources and regenerate.
- Prove dead candidates are not entry points, dynamic-import keys, barrel registrations, or externally consumed exports; read `knip.config.js` allowlists first and update them deliberately.
- Do not delete a migration path while save/resume/fixture consumers still need the old shape (check `MIGRATIONS.md`, `tests/fixtures/legacy-saves.ts`, guard tests). Deprecation comments alone do not close a window.
- Do not collapse [intentional dual seams](README.md#intentional-seams-do-not-collapse); Vite web vs Electron entries are this audit's extra seam to leave alone.
- A shared abstraction needs concrete consumers and a coherent responsibility. Do not force distinct product variants into configuration flags to satisfy a duplication count; follow existing UI ownership rules.
- Complexity scores and file length are discovery aids. Preserve cohesive rule code, wire formats, composition roots, and catalogs unless there is a demonstrated comprehension or change problem.
- Do not create new stores/managers beside existing owners for one flow; no React context for run/battle data; nothing React lands in `src/lib`.
- A broad change or large file is not itself a finding; confirm recurrence, drift, or an avoidable cause. Treat composition roots as expected fan-out.

## Evidence bars

- **Dead code:** zero live consumers after reference/registration/generated/E2E/barrel checks; knip is discovery, call-site evidence confirms.
- **Dual path:** two reachable paths for one behavior, or a reachable forwarding shim whose callers can retarget — plus a delete-one-path remedy that preserves behavior.
- **Duplicate surface:** show the same responsibility maintained independently and why sharing it prevents drift or repeated edits. Compare the resulting API and caller clarity with keeping the copies; call-site and prop counts do not decide the remedy.
- **Slop/mass:** identify a concrete cost such as needless indirection, mixed responsibilities, or repeated edits, and show how the remedy reduces it while preserving behavior. A name or single implementer alone is insufficient.
- **Ownership:** business rules in screens/controllers/fat stores instead of `src/lib`; persistence policy in UI; presentation inside engine rules; hub containment violations of capability ports.
- **Locality:** comparable changes repeatedly co-touching unrelated owners, or one policy/command maintained in several sources — with a stable before/after proxy.

## Remedies and verification

Choose deletion, retargeting, inlining, sharing, or moving responsibility according to the confirmed cause. Prefer the documented owner when paths compete, but inspect unique behavior and compatibility before selecting a survivor. A forwarding API may be an intentional boundary; remove it only when consumers can safely use the surviving owner.

Review the resulting caller path, not just the extracted helper. Check that the old responsibility is actually removed, callers remain understandable, intentional differences survive, and the remedy does not merely relocate complexity. Use existing behavior tests and required gates; add coverage when a meaningful preserved invariant lacks an owner. For locality findings, show the representative change that now needs fewer independent edits.

## Known signals

- `npm run deadcode:entry-exports`; unreferenced types/components; unread state/events; empty or stubbed tests; orphaned support surface (CSS, routes, helpers, docs).
- `legacy`/`compat`/`shim`/`v1` names imported beside newer owners; side-by-side barrel exports; hub methods that only forward.
- Parallel screen shells across `meta/`/`run-setup/`/`run-loop/`; repeated empty states, card grids, modal scaffolds, reward wrappers.
- Interface+single implementer+factory; `*Manager/*Helper/*Coordinator` around one function; boolean parameter soup; defensive cast stacks; complexity > 10 without domain reason.
- Battle math in `.tsx`; transient UI fields on save shapes; private aggregate/store-internal imports from outside `shared/stores/`; invented parallel hubs. Direct imports of the documented capability ports are the required feature boundary, not a finding.
- `node scripts/audit-change-amplification.mjs` clusters; duplicated policy across AGENTS/docs/scripts; madge cycles (`npm run audit:all`) remedied by inversion/extraction/facades — layer violations stay ESLint fixes.
