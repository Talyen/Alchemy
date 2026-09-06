# Active agent friction

Read only when the current task encounters a related failure or surprise. Current procedures belong in canonical owners, not this log.

Add one short row for unresolved friction with the observation and next useful action. When fixed, move the evidence to the current month's file in [history](./history/README.md), link the canonical prevention or explain why it was a one-off, and remove the active row. Do not reread resolved history routinely.

## Open

| Date       | Area            | Symptom (expected vs actual)                                                                                                                                                                                                                                            |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 | Tests           | `renderHook().rerender(newCallback)` silently skipped effect refires; `initialProps` + `rerender(props)` works.                                                                                                                                                         |
| 2026-09-03 | Reads/tests     | Early file reads went stale as the dirty tree shifted mid-session (`next-archery-free`, `thorns` missing); one transient parity failure cleared on re-run. Re-read touched files and re-run red tests before concluding.                                                |
| 2026-09-03 | Parallel edits  | Concurrent card-library edits duplicated a card id (`stargaze` in core + defense), failing the whole suite at import via the library guard; also overwrote a doc sentence mid-edit. Asked user, resolved per answer; re-verify shared files after any parallel session. |
| 2026-09-03 | Save docs       | MIGRATIONS.md described tombstone→hydrate→normalize and dropping of all unknown card IDs; code was migrate→validate→normalize→hydrate→restore and stripped only 2 tombstoned IDs. Fixed in-tree (strict catalog-liveness cleanup + layer-order rewrite).                |
| 2026-09-03 | E2E             | `save-error-paths` cold-start menu test times out (15s Play-button wait) when run under full `test:ship:e2e` parallel load; passes alone (7s) and file-alone (20s). Environmental, not save-logic.                                                                      |
| 2026-09-03 | Commands        | `dispatchRunSessionCommand` fires `afterCommit` even when Immer returns the base (no-op assignment); idempotent commands rely on it for navigation. Gating `afterCommit` on change would silently drop transitions. Left as-is.                                         |
| 2026-09-04 | UI docs         | `docs/UI.md` named a deleted trinket title module path and omitted the `fade-presence`/`fade-slot` shim layer; fixed in-tree alongside shim removal. N/A (one-off).                                                                                                     |
| 2026-09-04 | UI verification | A historical deleted filename in this log was parsed as a current file reference by docs verification; changed it to prose. N/A (one-off).                                                                                                                              |
| 2026-09-04 | React compiler  | Bundling callback refs with layout values produced ref-access lint errors at property reads; destructuring callbacks and values before JSX resolves the inference. N/A (one-off).                                                                                       |
| 2026-09-04 | Browser checks  | Overlapping Playwright invocations shared a dev server; one invocation teardown disconnected the other. Run browser batches serially or in one invocation. N/A (one-off).                                                                                               |

## Resolved history

[September 2026](./history/friction-2026-09.md). All previous resolved entries are preserved there.
