# Side-Effect Surface Audit

**Goal:** Confine I/O, shared mutation, environment access, and non-deterministic primitives to well-owned seams, and ensure those seams have coherent lifetime, failure, batching, and testability behavior.

## Intent

Fix confirmed ownership or quality defects across the complete rule → controller → store → storage/audio/IPC/browser chain. An allowed location is not enough: inspect atomicity, batching, cleanup, retry/error propagation, deduplication, hidden global coupling, and testability.

## Hard stops

- Non-fatal audio failures that log and continue are acceptable; do not “fix” them into crashing paths (`src/lib/audio/` and app audio-effect hooks).
- Steam upload / release checklist work belongs in [RELEASE.md](../RELEASE.md) — not this audit.
- Do not move battle simulation onto wall-clock randomness “for convenience.”
- Persistence timestamps and Zod hydrate under `src/lib/validation` / `shared/storage` may legitimately use `Date.now` — do not false-positive those seams.

## Investigation and evidence

This audit owns hidden/misplaced effects and inconsistent orchestration;
RuntimeCorrectness owns resulting behavioral failures.
Trace the creator, state/lifetime owner, failure handling, repetition and cancellation
of each effect through real consumers. Use [run state](../RUN_STATE.md#run-state),
[game rules](../GAME_RULES.md), [audio](../AUDIO.md) and storage/desktop contracts to
establish permitted seams. A folder name or clean lint result does not establish
semantic ownership.

Confirm hidden coupling, conflicting owners, an uncontrollable effect or a violated
lifetime/failure contract before adding an adapter. Injection must serve a concrete
consumer. Validate through teardown/re-entry, rollback, replay, error propagation or
rejected external input as applicable, without mocking away the behavior. Keep a
connected repair under one primary finding per the [shared contract](README.md#prioritize-and-remedy).

## Investigation leads

| Signal                                                                   | Required ownership / question                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Date.now`, `new Date`, unseeded gameplay draws                          | Battle uses the command-bound `world` stream; other run outcomes use their persisted streams. Check seed/presentation exceptions, transactional counters and resume continuity |
| Screen persist calls, duplicate writes/retries                           | Storage owners perform disk/localStorage I/O; domain commands mutate memory then delegate. Trace semantic events for duplicate persistence, emission or synchronization        |
| `getState()` or Electron/Steam/browser/environment APIs in pure rules    | `src/lib` remains React-free with no ad-hoc I/O; inject state and keep effects at documented seams                                                                             |
| Decorative entropy on render                                             | Initialize lazily with `useState(() => …)`; inspect entropy sources beyond `Math.random()`                                                                                     |
| Renderer/preload/IPC, file, URL or clipboard adapters                    | Validate external inputs and restrict sources/operations before effects; use local fixtures rather than live probing                                                           |
| Timers, observers, object URLs, subscriptions, global style/body changes | Does one creator own teardown? Are failures meaningful, repetition controlled, and required atomicity/order preserved?                                                         |
| Effectful module initialization                                          | Does the entrypoint require it, or should an explicit lifecycle own it?                                                                                                        |

Use existing diagnostics for banned calls: `alchemy/no-lib-fetch`,
`alchemy/no-unowned-web-storage` and `alchemy/no-render-math-random`. An allowed
folder does not prove seam quality; confirm lost errors, partial mutation,
uncontrolled lifetime or hidden coupling through consumers.
