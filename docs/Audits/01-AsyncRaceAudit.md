# 01. Async & Race Audit

**Goal:** Close confirmed async lifetime, ordering, concurrency, double-submit, and Electron IPC race risks — without converting APIs to async “for style.”

## Intent

Investigate high-risk candidates and fix confirmed lifetime/race issues across the complete async chain. Once confirmed, follow the operation through UI, controller, store, persistence, IPC, and completion consumers as applicable. Do not add abort controllers, mutex helpers, or concurrency tests without a demonstrated lifetime/race issue. Bounded sequencing or cancellation work may ship under the structural-fix policy in [README.md](README.md); new concurrency architecture remains a proposal. If the scope is large, phase the plan.

## Hard stops

- Do not introduce thread-blocking busy loops or `Atomics.wait`-style stalls on the UI thread.
- Prefer cancellable `useEffect` cleanups and AbortSignals over fire-and-forget promises that write after unmount.
- Do not relocate battle simulation into Workers unless Architecture already requires it.
- React Strict Mode double-mount is expected in development — fix real duplicate side effects (double persist, double grant), not the Strict Mode behavior itself.
- Double grant / double persist whose root cause is missing idempotency guards (not lifetime) → prefer `02-BehaviorHardeningAudit.md`.
- A companion idempotency fix may stay in this pass when it is part of the same overlapping operation and is required to make the race remedy complete.

## Severity

| Sev | Description                                                                       | Action                               |
| --- | --------------------------------------------------------------------------------- | ------------------------------------ |
| P0  | Double grant / double persist / unsynchronized shared mutable writes on hot paths | Fix now                              |
| P1  | setState / store write after unmount; listener leak                               | Fix when confirmed                   |
| P2  | Missing cleanup for timers/listeners; IPC reply after window close                | Establish ownership and cancellation |
| P3  | Redundant async wrappers with no race                                             | Skip unless trivial                  |
| P4  | Speculative Worker extraction                                                     | Propose only                         |

## Domain rules

**Safe patterns:** `useEffect` returns cleanup that clears timers, aborts fetches, and removes listeners; Zustand `subscribe` calls unsubscribe on teardown; disable primary actions while async work runs; Electron IPC handlers ignore stale or out-of-order replies for closed windows; overlapping saves and transitions serialize or reject stale completion; battle/run transitions are idempotent under re-entry (pair with `02-BehaviorHardeningAudit.md` when persistence is the bulk of the win).

Presence of `async` / `Promise` / IPC is not itself a defect — confirm lifetime, cancellation, and single-flight assumptions.

## Known signals

Optional discovery aids — choose your own probes.

- **Effects without cleanup:** `useEffect` that registers `addEventListener`, `setInterval`, or subscriptions without a teardown return.
- **Zustand subscribe leaks:** `.subscribe(` without matching unsubscribe.
- **Double-submit:** click handlers that kick async work without a re-entrancy guard (`isProcessing`, disabled button, in-flight ref).
- **Stale closures:** effects depending on unstable identities that re-fire expensive work unintentionally.
- **Store writes after await:** `await` then `setState` / store writes without mounted/abort checks on long paths.
- **Electron IPC races:** `desktop/main.cjs`, `desktop/preload.cjs` — handlers that assume a single in-flight request; overlapping save/load IPC without sequencing; replies after window close.
- **Strict Mode double effects:** mount-only persists or grants that fire twice in development and would double-apply in production under remount.
- **Out-of-order completion:** an older request, navigation, load, or calculation can overwrite a newer result.
- **Lost updates and overlapping transitions:** read-modify-write operations or queued actions operate on stale snapshots.
- **Unbounded async work:** event bursts or repeated requests create uncontrolled in-flight work, queue growth, or stale completion pressure.
