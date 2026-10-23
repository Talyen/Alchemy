# Runtime Correctness Audit

**Goal:** Find and fix real runtime defects — async lifetime/ordering races, persistence/recovery boundary gaps, idempotency holes, and opportunistic bug hunts — without converting APIs to async "for style" or adding machinery without a demonstrated failure.

## Scope

| Concern               | Owns                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Async lifetime        | Effects/subscriptions without cleanup, stale completions, IPC races, double-submit from lifetime gaps                     |
| Persistence hardening | Idempotency of transitions/grants, silent save failures, recovery at decode→mutate→persist→acknowledge→recover boundaries |
| Opportunistic defects | Confirmed crashes, data loss, wrong state, round-trip divergence — not a sibling re-run                                   |

Sibling routing: audio playback handling → SideEffectSurface; typing escapes → TypeSafety; unused API → Simplification (dead code). Keep connected causes and fixes together under one primary finding, following the [shared reporting contract](README.md#prioritize-and-remedy).

## Hard stops

- No busy-wait stalls on the UI thread; prefer cancellable cleanups and AbortSignals over fire-and-forget writes.
- Strict Mode double-mount is expected in development — fix real duplicate side effects, not Strict Mode itself.
- Do not relocate battle simulation into Workers unless architecture already requires it.
- Do not expand into speculative backlog or touch manifests/assets/audio unless they directly cause the confirmed defect.
- Use the current command, write, and lifecycle owners in [RUN_STATE.md](../RUN_STATE.md#run-state); do not bypass them with ad-hoc storage or state writes.

## Investigation and evidence

Trace input → validation → mutation → persistence → feedback → re-entry.
Exercise rapid repetition, navigation, failure, reload and stale completion.
Ordinary synchronous rule defects are in scope too.

Distinguish work allowed to outlive a screen from a stale operation that can
change a newer session. Identify the responsible guard, transaction or recovery
owner. For save/RNG defects, compare uninterrupted and resumed execution and
failed-command rollback. Unresolved balance or recovery intent remains a decision
under the [shared contract](README.md#shared-contract).

## Investigation leads

`async`, IPC, an empty catch or a missing local flag alone is not a defect.
Confirm lifetime, cancellation, single-flight and existing validation first.

| Signal                                                                        | Question                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Effects/listeners/subscriptions without visible cleanup; writes after `await` | Who owns teardown, and may work outlive the screen? Can stale completion overwrite a newer session?                                                           |
| Async click handlers, reward/shop/craft/stage re-entry                        | Does the existing command or interaction owner prevent duplicate mutation? Avoid adding a second guard without a gap                                          |
| Multi-field grant/purchase/craft or persist/hydrate/resume seams              | Do schemas/repair, rollback, write acknowledgement, retry and backup/Cloud recovery preserve atomic state? Partial durable success must never appear complete |
| Caught/ignored failures                                                       | Can the caller falsely acknowledge success, lose data or make recovery impossible? Non-fatal audio may intentionally continue                                 |
| Save imports, renderer/IPC inputs, file/URL operations                        | Are malformed payloads, stale sessions and unintended access rejected by the desktop boundary? Use local fixtures, never live services or real player data    |
| Array indexing, Gold/Health arithmetic, empty decks or maxed upgrades         | Can a reachable boundary value violate bounds or strand progression?                                                                                          |
| Navigation/reward/shop/outcome state combinations                             | Can repetition, reload, stale IDs or web/Electron differences produce a stuck or divergent state?                                                             |

Trace save candidates through `parseActiveRun`, `snapshotRun`, `restoreRun`,
`shared/storage/` and `src/lib/active-run-session/` as relevant; silent repair must
match the documented policy rather than an assumed strict-validation rule.
