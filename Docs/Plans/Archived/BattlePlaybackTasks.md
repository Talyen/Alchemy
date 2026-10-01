---
status: complete
updated: 2026-09-30
---

# Battle playback tasks

## Objective

Give asynchronous battle presentation one owner for completion, cancellation,
and resource cleanup. Preserve card travel, stable-slot measurement, draw timing,
and gameplay commands while making battle exit and restart easier to maintain.

## Findings and design

Frame waits, stable hand measurements, and transfer timers independently implement
settled flags, unregister functions, and synchronous-registration race handling.
The lifetime owns cancellation, but each consumer reconstructs resource ownership.
Exceptions in a scheduled callback can strand its promise and presentation state.

Introduce a local playback task contract: a task completes once, owns cleanup,
and schedules callbacks that cannot execute after settlement. The existing
lifetime remains the cancellation owner. Browser frame requests and existing
TimerGroup schedulers remain the I/O seams. Cancellation returns the consumer's
existing fallback; failure rejects after releasing resources. This is a concrete
shared owner for three consumers, with no persistence or gameplay changes.

## Plan

- [x] Implement the task owner with synchronous cancellation and scheduling safety.
- [x] Migrate lifetime frame waits, stable measurements, and card transfers.
- [x] Test normal completion, exit/restart, stale callbacks, synchronous races,
      and failure cleanup while retaining existing presentation regression tests.
- [x] Document the contract in battle controllers, review the integration, run
      task-scoped handoff checks, and archive this plan.

## Scope

Existing combat-rule and talent edits are unrelated and remain untouched.
Run resume's parallel activity representations and victory rewards' broad input
contract are future candidates; this brief review does not rank the entire repo.

Follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and
[the plan lifecycle](../README.md#task-handoff).

## Result and validation

Implemented one task owner and migrated all three consumers. Existing focused
presentation checks passed (32 tests across six files); added direct coverage for
measurement failure cleanup afterward. The first handoff run passed dependency
and changed-test verification, type checks, docs, formatting, and dead-code checks.
It found three lint issues in the new owner; corrected rejection normalization
and the synchronous-scheduler cleanup holder. Final handoff checks run against
the archived plan and all implementation paths. No tests were retired.
