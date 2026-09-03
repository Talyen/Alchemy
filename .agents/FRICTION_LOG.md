# Friction Log

Centralized intake for agent pain points, confusion, and struggle while working in this codebase. Keep entries short — one line in the table is enough. Use the expanded template only when extra context helps.

Add a row to `Open` when docs mislead, behavior surprises, or repeated friction appears. Move it to `Resolved` with a fix link plus either a `knowledge/patterns/<name>.md` link or `N/A (one-off)` with a one-line reason. Second recurrence in the same `Area` promotes to a pattern candidate per `knowledge/index.md`.

## How to log

1. Add a row to `## Open` below.
2. For longer context, add a `### YYYY-MM-DD — short slug` subsection under `## Details` using the template at the bottom.
3. When resolved, move the row to `## Resolved` and include a commit, PR, or `knowledge/patterns/<name>.md` link — or `N/A (one-off)` with reason. Flag a second same-area recurrence as a pattern candidate.

## Open

| Date       | Area           | Symptom (expected vs actual)                                                                                                                                                                                                                                            |
| ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 | Tests          | `renderHook().rerender(newCallback)` silently skipped effect refires; `initialProps` + `rerender(props)` works.                                                                                                                                                         |
| 2026-09-03 | Reads/tests    | Early file reads went stale as the dirty tree shifted mid-session (`next-archery-free`, `thorns` missing); one transient parity failure cleared on re-run. Re-read touched files and re-run red tests before concluding.                                                |
| 2026-09-03 | Parallel edits | Concurrent card-library edits duplicated a card id (`stargaze` in core + defense), failing the whole suite at import via the library guard; also overwrote a doc sentence mid-edit. Asked user, resolved per answer; re-verify shared files after any parallel session. |
| 2026-09-03 | Save docs      | MIGRATIONS.md described tombstone→hydrate→normalize and dropping of all unknown card IDs; code was migrate→validate→normalize→hydrate→restore and stripped only 2 tombstoned IDs. Fixed in-tree (strict catalog-liveness cleanup + layer-order rewrite).                |
| 2026-09-03 | Commands       | `dispatchRunSessionCommand` fires `afterCommit` even when Immer returns the base (no-op assignment); idempotent commands rely on it for navigation. Gating `afterCommit` on change would silently drop transitions. Left as-is.                                         |

## Resolved

| Date       | Area           | Resolution (commit / pattern link, or N/A + reason)                                                                                                                                                                                                      |
| ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 | Agent scope    | Replaced blanket unrelated-path avoidance with the safe incidental-fix policy in [AGENTS.md](../AGENTS.md#working-style).                                                                                                                                |
| 2026-09-02 | Verification   | Replaced duplicated push/handoff gates and incomplete child-only records with one source-aware `check` run.                                                                                                                                              |
| 2026-09-03 | Knip entries   | Explicit `src/main.tsx` / `src/startup.ts` entries flagged redundant under `--treat-config-hints-as-errors`; Vite/HTML plugins auto-infer them — documented in `knip.config.js`, keep only `src/App.tsx`.                                                |
| 2026-09-02 | Script budgets | `ROUTE_CONTEXT_BUDGETS` assets total went stale (test red on main); budgets now enforced by `context-hotspots --check`.                                                                                                                                  |
| 2026-09-03 | Lint guards    | Dead ban entries (`battle-store`, `run-domain-store`) could not be removed from `eslint/fragments.js` because `lint-architecture-smoke` asserted their presence; smoke assertion now targets live `run-session-write-port` (this commit), N/A (one-off). |
|            |                |                                                                                                                                                                                                                                                          |

## Details

_Add expanded entries here when the table row is not enough. Keep the table as the index._

### Expanded entry template

Copy and fill when needed:

```
### YYYY-MM-DD — short slug

- **Context:** what you were trying to do
- **Expected:** what you expected to happen / where you expected to find it
- **Actual / confusion:** what happened or what was confusing
- **Impact:** how it slowed you down or affected the task
- **Suggestion (optional):** what would have helped
```
