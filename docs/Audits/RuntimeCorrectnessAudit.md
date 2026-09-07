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
- Use the current command, write, and lifecycle owners in [ARCHITECTURE.md](../ARCHITECTURE.md#run-state); do not bypass them with ad-hoc storage or state writes.

## Investigation and evidence

Follow important transitions from input through validation, mutation, persistence, feedback, and re-entry. Compare expected and actual outcomes at interruption points: rapid repetition, navigation away, failure, reload, and stale completion. Include ordinary synchronous rule defects; async syntax is not required for a finding.

Confirm a reachable failure or a violated invariant and the guard, transaction, or recovery owner responsible. Distinguish an operation allowed to outlive a screen from a stale operation that can corrupt a newer session. Prioritize irreversible loss and blocked or incorrect progress using the shared contract; a missing cleanup or empty catch has no fixed severity.

Verification should fail for the original defect and exercise the repaired boundary, including failure/re-entry where relevant. For save or RNG defects, compare uninterrupted execution with save/resume, and check failed-command rollback. Ambiguous balance or recovery policy requires evidence and a decision, not an invented fallback.

## Domain rules

- **Lifetime:** effects and subscriptions have an owner responsible for teardown. Confirm whether outstanding work must be cancelled or may complete safely; prevent stale replies from changing a newer session. Primary actions prevent unintended duplicate mutations through the existing command or interaction owner, not necessarily a new UI flag.
- **Persistence:** validate critical fields under the documented save schemas and repair policy. Trace how write failures affect acknowledgement, retry, and recovery; inspect existing import/export/backup/cloud paths as applicable. Multi-step mutations preserve their documented atomicity and never acknowledge partial durable state as complete.
- **Idempotency:** reward claim, shop buy, craft, stage completion tolerate double-click/re-entry before mutating.
- **Failure handling:** trace caught, ignored, and rejected errors through callers. Confirm whether success is falsely acknowledged, player data is lost, or recovery becomes impossible; an empty catch alone is not a finding. Non-fatal audio may intentionally continue.
- **Trust boundaries:** trace save imports and renderer/IPC inputs through validation and authorized operations. Check malformed payloads, stale sessions, and unintended file/URL access against desktop contracts; do not probe live services or real player data.
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
