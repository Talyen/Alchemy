# Side-Effect Surface Audit

**Goal:** Confine I/O, shared mutation, and non-deterministic primitives to designated seams — none in pure logic / domain models.

## Intent

Confirm unexpected effect ownership and fix violations using existing seams. A clean pass is valid. A new seam requires repeated confirmed violations, at least three current uses or an enforced boundary, and proposal approval per [README.md](README.md). If the scope is large, phase the plan.

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

## Domain rules

- **Battle:** no `Math.random` / unseeded entropy / `Date.now` / `crypto.randomUUID` / `performance.now` in rule code under `src/lib/battle`; handlers consume injected RNG.
- **Persistence:** disk/localStorage writes route through storage owners; domain stores mutate memory then delegate; screens do not write saves directly.
- **Pure lib:** `src/lib/**` stays free of React and of ad-hoc I/O; push effects to seams. Prefer injected state over `useXStore.getState()` inside pure rule handlers.
- **UI:** decorative randomness must not re-roll every render — initialize lazily (`useState(() => …)`).
- **Fetch / network:** not expected in core game loop; treat unexpected `fetch` in `src/lib` as a finding unless an existing allowlisted owner.

## Known signals

Optional discovery aids — choose your own probes.

- **Unseeded entropy outside seams:** `Math.random` / `Date.now` / `new Date(` / `fetch(` / `localStorage` / `sessionStorage` outside allowlisted owners.
- **Battle entropy leaks:** unseeded entropy under `src/lib/battle` — target 0.
- **Direct storage from screens:** `localStorage` / persist calls outside `shared/storage` and boot/hydrate.
- **Global mutable access in pure logic:** `getState()` inside `src/lib` rule handlers — prefer injected state.
- **Desktop IPC in pure lib:** Electron/Steam APIs imported from `src/lib` battle/game-data paths.
- **UI re-roll:** `Math.random` inside render bodies without lazy state init.
