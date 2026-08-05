# 05. Dead Code & API Surface Audit

**Goal:** Remove clearly obsolete authored surface — unused symbols/APIs, unreachable branches, exhausted flags, and orphaned registrations or support files — without deleting live entry points.

## Intent

Identify confirmed obsolete authored surface and clean up the complete deletion cascade. A clean pass is valid. Prefer narrowing exports (module-private) when the API remains useful inside its folder. Once an owner is proven dead, follow callers, barrels, routes, styles, tests, docs, configuration, generated inputs, and assets that exist only for it. A successful fix must report authored LOC, declarations, files, branches, registrations, or exported API removed; moving the same surface is not dead-code reduction. Reachable twins / no-op shims with live callers belong to `08-DualPathRetentionAudit.md`. If the scope is large, phase the plan.

## Hard stops

- Do not delete symbols referenced from Playwright specs, page objects, Vitest fixtures, or generated output without regenerating first.
- Prove a candidate is not an app entry point, Vite/Electron entry, dynamic import key, asset barrel registration, or externally consumed export.
- Do not hand-edit generated assets/metadata — remove unused entries from sources and run the owning sync/asset script (`npm run sync:assets`, `sync:gear-art`, related prebuild steps). Real artifacts include `assets.generated.ts` and `metadata.generated.ts`.
- Orphaned-test rule is **not** 1:1 file mirroring — support helpers, architecture guards, and invariant suites are valid without a twin production file.
- Absolute “zero dead exports” is **not** the gate; high-confidence unused is. Confirm with call-site evidence; knip alone will not catch every dynamic reference.
- Do not remove knip-allowlisted intentional seams without proving zero callers **and** deliberately updating `knip.config.js` (`entry` / `ignoreIssues`).
- Test fixtures intentionally unused by product code — do not delete them for lacking app call sites.
- Do not delete a retired persistence shape, migration, feature flag, or route until supported-save, rollout, and registration inventories prove its consumer window is closed.

## Domain rules

- Same-module-only symbols should not be re-exported from barrels without an external caller.
- Unused generated catalog/asset entries → delete from source + regenerate.
- Delete source only after reference, registration, generated-output, E2E, and barrel checks establish it is not an entry point.
- Delete empty / fully commented-out test files; keep intentional cross-cutting suites.
- Delete unreachable branches, exhausted temporary flags, unused union/event variants, unread store fields, orphaned styles, abandoned test helpers, and stale configuration only after their dynamic and compatibility consumers are disproven.
- Inline single-use helpers when inlining reduces total LOC (ceremony-only single-use → also see `11-InelegantSlopAudit.md`).
- Read `knip.config.js` before treating an “unused” facade export as dead.
- After deletions, run `npm run deadcode` to confirm the pass introduced no new hits (removals often orphan their own helpers).

## Known signals

Optional discovery aids — choose your own probes. See also the [measurable sweep map](README.md#measurable-sweep-map-npm-run-auditall).

- **Strict deadcode:** `npm run deadcode:strict`
- **Single-use exports:** `npm run audit:single-use`
- **Unreferenced types & components:** declared in `src/features` / `src/lib` with no remaining import sites.
- **Unread React state:** `useState` / store fields written but never read.
- **Uncalled private helpers:** local functions in large modules with zero call sites.
- **Empty / stub tests:** test files with zero `it`/`test` cases or fully commented bodies.
- **Orphaned tests for deleted source:** remove when the production symbol is gone.
- **Unreachable authored paths:** constant conditions, exhausted rollout flags, obsolete fallback branches, and impossible switch variants.
- **Orphaned support surface:** CSS selectors, route/config entries, test helpers, docs, and authored asset/catalog inputs whose sole owner was removed.
- **Unread state and events:** store fields, actions, event variants, or payload properties written or emitted but never consumed.
