# Simplification Audit

Merges the former Change Locality & Context Efficiency (04), Dead Code (05), Dual-Path Retention (08), Duplicate Feature Surface (09), Inelegant Slop (11), and State Gravity & Ownership (14) audits.

**Goal:** Reduce authored surface, duplication, misownership, and agent-context cost — delete the obsolete, collapse the duplicated, rehome the misplaced — without inventing new seams or frameworks.

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
- No generic UI builders/form engines/registries to collapse two or three screens; no `shared/ui` move unless ≥2 feature domains need it; keep intentional product variants distinct.
- Do not split clean ≤10-complexity functions; skip load-bearing density (battle pipeline math, save wire format, controller composition, large catalogs where the job is the catalog).
- Do not create new stores/managers beside existing owners for one flow; no React context for run/battle data; nothing React lands in `src/lib`.
- A broad change or large file is not itself a finding; confirm recurrence, drift, or an avoidable cause. Treat composition roots as expected fan-out.

## Evidence bars

- **Dead code:** zero live consumers after reference/registration/generated/E2E/barrel checks; knip is discovery, call-site evidence confirms.
- **Dual path:** two reachable paths for one behavior, or a reachable forwarding shim whose callers can retarget — plus a delete-one-path remedy that preserves behavior.
- **Duplicate surface:** two substantial twins an existing owner absorbs cleanly (else three, or two with demonstrated drift); parameterization stays under 2–3 simple props.
- **Slop/mass:** hotspot relative to peers + avoidable cause + existing home + measurable direction (LOC/declarations/indirection/review surface down, behavior intact).
- **Ownership:** business rules in screens/controllers/fat stores instead of `src/lib`; persistence policy in UI; presentation inside engine rules; hub containment violations of capability ports.
- **Locality:** comparable changes repeatedly co-touching unrelated owners, or one policy/command maintained in several sources — with a stable before/after proxy.

## Remedies

Prefer in order: delete → retarget callers → inline → parameterize proven duplication under an existing owner → move to the documented architecture owner. When neither dual-path survivor is marked, prefer architecture/facade/`src/lib` owner over hub twin, unique behavior over forwarder; call-site count is a last tie-break. Move rather than mirror: migrate callers and tests, then delete forwarding APIs. Every shipped locality finding reports its before/after proxy and unchanged correctness signal.

## Known signals

- `npm run deadcode:entry-exports`; unreferenced types/components; unread state/events; empty or stubbed tests; orphaned support surface (CSS, routes, helpers, docs).
- `legacy`/`compat`/`shim`/`v1` names imported beside newer owners; side-by-side barrel exports; hub methods that only forward.
- Parallel screen shells across `meta/`/`run-setup/`/`run-loop/`; repeated empty states, card grids, modal scaffolds, reward wrappers.
- Interface+single implementer+factory; `*Manager/*Helper/*Coordinator` around one function; boolean parameter soup; defensive cast stacks; complexity > 10 without domain reason.
- Battle math in `.tsx`; transient UI fields on save shapes; direct aggregate/port imports from feature code outside `**/stores/**`; invented parallel hubs.
- `node scripts/audit-change-amplification.mjs` clusters; duplicated policy across AGENTS/docs/scripts; madge cycles (`npm run audit:all`) remedied by inversion/extraction/facades — layer violations stay ESLint fixes.
