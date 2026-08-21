# Runtime Correctness Audit

Merges the former Async & Race (01), Behavior Hardening (02), and Bug Hunting (03) audits.

**Goal:** Find and fix real runtime defects — async lifetime/ordering races, persistence/recovery boundary gaps, idempotency holes, and opportunistic bug hunts — without converting APIs to async "for style" or adding machinery without a demonstrated failure.

## Scope

| Concern               | Owns                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Async lifetime        | Effects/subscriptions without cleanup, stale completions, IPC races, double-submit from lifetime gaps                     |
| Persistence hardening | Idempotency of transitions/grants, silent save failures, recovery at decode→mutate→persist→acknowledge→recover boundaries |
| Opportunistic defects | Confirmed crashes, data loss, wrong state, round-trip divergence — not a sibling re-run                                   |

Sibling routing: audio playback handling → SideEffectSurface; typing escapes → TypeSafety; unused API → Simplification (dead code). A connected companion fix may ship here when required to complete the same invariant; report both classifications.

## Hard stops

- No busy-wait stalls on the UI thread; prefer cancellable cleanups and AbortSignals over fire-and-forget writes.
- Strict Mode double-mount is expected in development — fix real duplicate side effects, not Strict Mode itself.
- Do not relocate battle simulation into Workers unless architecture already requires it.
- Do not run unrelated full-repo sweeps; do not rename/restyle or refactor unrelated code while hunting.
- Do not expand into speculative backlog or touch manifests/assets/audio unless they directly cause the confirmed defect.
- Run lifecycle mutations go through `run-session-lifecycle-port.ts`; no ad-hoc `localStorage` writes from screens.

## Severity

| Sev | Criteria                                                                            | Default                       |
| --- | ----------------------------------------------------------------------------------- | ----------------------------- |
| P0  | Crash / data loss / double grant / save corruption / unsynchronized hot-path writes | Fix now                       |
| P1  | Wrong battle/progress/UI state; store write after unmount; lost persistence error   | Fix when confirmed            |
| P2  | Degraded UX; missing timer/listener cleanup; recovery hides meaningful failure      | Fix when confirmed and scoped |
| P3  | Recoverable failure without diagnostics; redundant async wrappers; style-only churn | Fix only if trivial           |
| P4+ | Maintainability or speculative restructuring                                        | Defer / propose only          |

Balance retunes, player-facing copy/layout choices, and ambiguous product intent: skip and note — never block waiting for answers.

## Domain rules

- **Lifetime:** effects clear timers, abort fetches, remove listeners; Zustand subscriptions unsubscribe; primary actions disable during async work; Electron IPC ignores stale/out-of-order replies for closed windows; overlapping saves serialize or reject stale completion.
- **Persistence:** critical fields validated via Zod under `src/lib/validation/save-schemas/`; silent save failure is data loss; import/export/backup/cloud paths enforce the same guarantees as the local path; multi-step mutations never expose partially completed durable state.
- **Idempotency:** reward claim, shop buy, craft, stage completion tolerate double-click/re-entry before mutating.
- **Swallowed errors:** empty `catch` on save/hydrate/resume/battle-outcome paths are findings. Allowlist: non-fatal audio (`src/lib/audio*.ts`).
- Presence of `async`/IPC is not a defect — confirm lifetime, cancellation, and single-flight assumptions first.

## Known signals

- Effects registering listeners/intervals without teardown; `.subscribe(` without unsubscribe.
- Click handlers starting async work without an `isProcessing`/disabled/in-flight guard.
- `await` then setState/store writes without mounted/abort checks; out-of-order completion overwriting newer results.
- Persist/hydrate/resume seams (`parseActiveRun`, `snapshotRun`, `restoreRun`, `shared/storage/`, `src/lib/active-run-session/`) discarding corrupt data silently.
- Non-atomic multi-field updates before a single persist; partial transactions across grant/purchase/craft phases.
- Array index access without guards in `src/lib/battle`, `src/lib/gear`, stores; unchecked `gold - cost` / `hp - damage` underflow.
- Impossible/stuck state-machine combinations across navigation, rewards, shops, victory/defeat, resume.
- Save→reload or web→Electron behavior divergence; boundary values (empty decks, maxed upgrades, stale identifiers).
