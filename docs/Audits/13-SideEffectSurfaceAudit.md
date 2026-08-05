# 13. Side-Effect Surface Audit

**Goal:** Confine I/O, shared mutation, environment access, and non-deterministic primitives to well-owned seams, and ensure those seams have coherent lifetime, failure, batching, and testability behavior.

## Intent

Confirm unexpected effect ownership or a defective allowed seam and fix the complete effect chain using existing owners. Inspect pure rule → controller → store → storage/audio/IPC/browser consumer as applicable. Allowed location alone does not prove good ownership: atomicity, batching, cleanup, retry/error propagation, deduplication, hidden global coupling, and testability remain in scope. A clean pass is valid. A new seam requires repeated confirmed violations, at least three current uses, two demonstrated drifting implementations, or an enforced boundary, and follows the structural-fix policy in [README.md](README.md). If the scope is large, phase the plan.

## Hard stops

- Non-fatal audio failures that log and continue are acceptable; do not “fix” them into crashing paths (`src/lib/audio*.ts` and app audio-effect hooks).
- Steam upload / release checklist work belongs in [RELEASE.md](../RELEASE.md) — not this audit.
- Do not move battle simulation onto wall-clock randomness “for convenience.”
- Persistence timestamps and Zod hydrate under `src/lib/validation` / `shared/storage` may legitimately use `Date.now` — do not false-positive those seams.

## Allowlisted seams

| Effect                                                      | Allowed locations                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `localStorage` / save I/O / Zod parse                       | `shared/storage/`, `src/lib/validation/save-schemas/`, `src/lib/active-run-session/`, hydrate/boot paths |
| Zustand store mutation                                      | `shared/stores/` (+ facade writes from controllers)                                                      |
| Audio                                                       | `src/lib/audio*.ts`, app audio-effect hooks                                                              |
| Electron / Steam IPC                                        | `desktop/`, preload bridges, Steam helpers — not `src/lib/battle`                                        |
| Unseeded / wall-clock randomness                            | Outside battle rule code; battle uses injected RNG                                                       |
| Seeded RNG                                                  | `state.rng` / `getBattleRng(state)` in battle + tests                                                    |
| Session / presentation identity (`crypto.randomUUID`, etc.) | Ephemeral UI/session tokens outside battle entropy                                                       |
| Persistence timestamps (`Date.now`)                         | Save metadata / storage / validation seams only                                                          |
| Browser / DOM environment APIs                              | UI effects, shell/controller lifecycle owners, or a named adapter — not pure rules                       |
| Timers / observers / clipboard / visibility                 | The UI or shell lifetime that creates them, with teardown and injected/testable boundaries as applicable |

## Domain rules

- **Battle:** no `Math.random` / unseeded entropy / `Date.now` / `crypto.randomUUID` / `performance.now` in rule code under `src/lib/battle`; handlers consume injected RNG.
- **Persistence:** disk/localStorage writes route through storage owners; domain stores mutate memory then delegate; screens do not write saves directly.
- **Pure lib:** `src/lib/**` stays free of React and of ad-hoc I/O; push effects to seams. Prefer injected state over `useXStore.getState()` inside pure rule handlers.
- **UI:** decorative randomness must not re-roll every render — initialize lazily (`useState(() => …)`).
- **Fetch / network:** not expected in core game loop; treat unexpected `fetch` in `src/lib` as a finding unless an existing allowlisted owner.
- **Allowed-seam quality:** an allowed owner still must surface meaningful failures, avoid duplicate work, clean up its lifetime, and preserve atomic or ordered behavior where required.
- **Module initialization:** effectful work at import time must be required by the entrypoint contract; otherwise move it to an explicit owning lifecycle.

## Known signals

Optional discovery aids — choose your own probes.

- **Unseeded entropy outside seams:** `Math.random` / `Date.now` / `new Date(` / `fetch(` / `localStorage` / `sessionStorage` outside allowlisted owners.
- **Battle entropy leaks:** unseeded entropy under `src/lib/battle` — target 0.
- **Direct storage from screens:** `localStorage` / persist calls outside `shared/storage` and boot/hydrate.
- **Global mutable access in pure logic:** `getState()` inside `src/lib` rule handlers — prefer injected state.
- **Desktop IPC in pure lib:** Electron/Steam APIs imported from `src/lib` battle/game-data paths.
- **UI re-roll:** `Math.random` inside render bodies without lazy state init.
- **Browser/global access:** `window`, `document`, clipboard, observers, visibility/focus, environment, or location APIs inside pure rules or unowned module initialization.
- **Unowned lifetime:** timers, observers, object URLs, subscriptions, or global style/body mutations without a creator responsible for teardown.
- **Duplicate effect orchestration:** multiple callers independently persist, emit, play, synchronize, or retry the same semantic event.
- **Weak allowed seam:** effect is in an allowlisted folder but silently loses errors, repeats work, exposes partial mutation, or cannot be controlled in tests.
