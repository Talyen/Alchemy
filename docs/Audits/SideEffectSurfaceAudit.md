# Side-Effect Surface Audit

**Goal:** Confine I/O, shared mutation, environment access, and non-deterministic primitives to well-owned seams, and ensure those seams have coherent lifetime, failure, batching, and testability behavior.

## Intent

Fix confirmed ownership or quality defects across the complete rule → controller → store → storage/audio/IPC/browser chain. An allowed location is not enough: inspect atomicity, batching, cleanup, retry/error propagation, deduplication, hidden global coupling, and testability.

## Hard stops

- Non-fatal audio failures that log and continue are acceptable; do not “fix” them into crashing paths (`src/lib/audio*.ts` and app audio-effect hooks).
- Steam upload / release checklist work belongs in [RELEASE.md](../RELEASE.md) — not this audit.
- Do not move battle simulation onto wall-clock randomness “for convenience.”
- Persistence timestamps and Zod hydrate under `src/lib/validation` / `shared/storage` may legitimately use `Date.now` — do not false-positive those seams.

## Investigation and evidence

Trace who creates an effect, owns its state and lifetime, handles failure, and can repeat or cancel it. This audit owns misplaced or hidden effects and inconsistent orchestration; RuntimeCorrectness owns the resulting behavioral failures. Keep a connected repair together under one primary finding.

Use [ARCHITECTURE.md](../ARCHITECTURE.md#run-state), [GAME_RULES.md](../GAME_RULES.md), [AUDIO.md](../AUDIO.md), and the relevant storage/desktop owners to establish permitted seams. A folder name is neither proof of safety nor permission to perform every effect. Existing lint rules identify mechanical boundary violations; investigate the semantic assumptions they cannot enforce.

Confirm hidden dependencies, conflicting owners, an uncontrolled effect that prevents meaningful testing, or a violated lifetime/failure contract before proposing an adapter. Injection is useful when it gives a concrete consumer control; do not create a universal effect framework.

Verify the original ownership or behavior problem is resolved through actual consumers. Depending on the effect, exercise teardown/re-entry, rollback, deterministic replay, error propagation, or rejected external input. Tests should control the seam without replacing the behavior they are meant to verify.

## Domain rules

- **Entropy:** battle rules consume the command-bound `world` stream; other run outcomes use their documented persisted streams. Follow current RNG owners for seed creation and presentation randomness. Being outside battle code does not make unseeded gameplay entropy safe.
- **Persistence:** disk/localStorage writes route through storage owners; domain stores mutate memory then delegate; screens do not write saves directly.
- **Pure lib:** `src/lib/**` stays free of React and of ad-hoc I/O; push effects to seams. Prefer injected state over `useXStore.getState()` inside pure rule handlers.
- **UI:** decorative randomness must not re-roll every render — initialize lazily (`useState(() => …)`).
- **Trust boundaries:** renderer/preload/IPC bridges and file, URL, clipboard, or environment adapters expose only intended capabilities and validate external inputs before effects. Check source/operation restrictions and error handling against current desktop contracts; use local fixtures, not live-service probing.
- **Seam quality:** a documented owner still must surface meaningful failures, avoid duplicate work, clean up its lifetime, and preserve atomic or ordered behavior where required.
- **Module initialization:** effectful work at import time must be required by the entrypoint contract; otherwise move it to an explicit owning lifecycle.

## Known signals

- **Unseeded entropy outside seams:** `Date.now` / `new Date(` / non-UI `Math.random` outside documented owners. `fetch(` under `src/lib` is `alchemy/no-lib-fetch`; `localStorage` / `sessionStorage` in `src` are `alchemy/no-unowned-web-storage`.
- **Run entropy leaks:** draws outside the owning persisted stream, counters that advance without their outcome committing, or randomness that diverges after resume; use lint diagnostics for directly banned calls.
- **Direct storage from screens:** remaining persist-call leaks that are not `localStorage` / `sessionStorage` identifiers (those are lint).
- **Global mutable access in pure logic:** `getState()` inside `src/lib` rule handlers — prefer injected state.
- **Desktop IPC in pure lib:** Electron/Steam APIs imported from `src/lib` battle/game-data paths.
- **UI re-roll:** remaining render entropy that is not `Math.random()` (`alchemy/no-render-math-random` covers that call).
- **Browser/global access:** `window`, `document`, clipboard, observers, visibility/focus, environment, or location APIs inside pure rules or unowned module initialization.
- **Unowned lifetime:** timers, observers, object URLs, subscriptions, or global style/body mutations without a creator responsible for teardown.
- **Duplicate effect orchestration:** multiple callers independently persist, emit, play, synchronize, or retry the same semantic event.
- **Weak seam:** effect is in a documented owner but silently loses errors, repeats work, exposes partial mutation, or cannot be controlled in tests.
