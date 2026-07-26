# Dead Code & API Surface Audit

**Goal:** Remove clearly unused internal symbols and narrow unnecessary exported APIs without deleting live entry points.

## Intent

Identify all confirmed unused internal symbols and unnecessary APIs, and write a plan to clean them up (breaking into phases if the scope is large). A clean pass is valid. Prefer narrowing exports (module-private) when the API remains useful inside its folder. A successful fix must report authored LOC, declarations, files, or exported API removed; moving the same surface is not dead-code reduction.

## Hard stops

- Do not delete symbols referenced from Playwright specs, page objects, Vitest fixtures, or generated output without regenerating first.
- Prove a candidate is not an app entry point, Vite/Electron entry, dynamic import key, asset barrel registration, or externally consumed export.
- Do not hand-edit generated assets/metadata — remove unused entries from sources and run the owning sync/asset script (`npm run sync:assets`, `sync:gear-art`, related prebuild steps). Real artifacts include `assets.generated.ts` and `metadata.generated.ts`.
- Orphaned-test rule is **not** 1:1 file mirroring — support helpers, architecture guards, and invariant suites are valid without a twin production file.
- Absolute “zero dead exports” is **not** the gate; high-confidence unused is. Use `npm run deadcode:strict` as a primary signal, then confirm with `rg`.
- Do not remove knip-allowlisted intentional seams without proving zero callers **and** deliberately updating `knip.config.js` (`entry` / `ignoreIssues`).
- Test fixtures intentionally unused by product code — do not delete them for lacking app call sites.

## Domain rules

- Same-module-only symbols should not be re-exported from barrels without an external caller.
- Unused generated catalog/asset entries → delete from source + regenerate.
- Delete source only after reference, registration, generated-output, E2E, and barrel checks establish it is not an entry point.
- Delete empty / fully commented-out test files; keep intentional cross-cutting suites.
- Inline single-use helpers when inlining reduces total LOC (`npm run audit:single-use` as a hint; ceremony-only single-use → also see `InelegantSlopAudit.md`).
- Confirm every candidate with `rg` call-site proof — knip alone will not catch every dynamic reference. Read `knip.config.js` before treating an “unused” facade export as dead.

## Probe hints

- **Strict deadcode:** `npm run deadcode:strict`
- **Single-use exports:** `npm run audit:single-use`
- **Unreferenced types & components:** declare in `src/features` / `src/lib`, verify with `rg` that no import sites remain.
- **Unread React state:** `useState` / store fields written but never read.
- **Uncalled private helpers:** local functions in large modules with zero call sites.
- **Empty / stub tests:** test files with zero `it`/`test` cases or fully commented bodies.
- **Orphaned tests for deleted source:** remove when the production symbol is gone.
