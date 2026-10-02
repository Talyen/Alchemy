# Agent friction resolutions and mitigations — October 2026

Historical evidence; current instructions live in the linked canonical owners.

2026-10-02 — Node Web Storage isolation is owned by
[the JSDOM environment](../../tests/jsdom-environment.ts), installed before DOM
test imports. It removes native storage descriptors without reading their
getters, lets JSDOM provide local/session storage, and restores Node descriptors
on teardown or initialization failure. Original evidence: on affected Node 24
runtimes the experimental global `localStorage` getter returned undefined without
`--localstorage-file` and shadowed JSDOM in Vitest; affected focused DOM checks
passed with `NODE_OPTIONS=--no-experimental-webstorage`. On current Node 24.18.0
the getter is absent by default, but enabling `--experimental-webstorage`
reproduced a throwing getter at `tests/lib/platform-storage.test.ts:20`. The
environment handles both cases without a Node storage file or product save
changes. Prevention: [DOM test policy](../../CONTRIBUTING.md#what-to-run-when-you-change).

2026-10-02 — Participating one-shot unit/browser commands now share
[one host-local test lane](../../scripts/lib/verification/local-test-lane.mjs).
An overlapping command fails before collection; the OS releases the listener
when its owner exits. Lightweight local smoke remains outside this lane, full
verification remains opt-in, the existing four-worker ceiling is retained, and
native bundler threads default to one. Real-socket regressions cover contention,
owner termination, subsequent reuse, and preserving an unrelated listener.
Raw CLI/watch commands and unrelated host workloads remain outside this
coordination. The [open friction entry](../FRICTION_LOG.md#open) retains the
remaining collection/host-pressure investigation. Prevention:
[test policy](../../CONTRIBUTING.md#what-to-run-when-you-change) and
[implementation](../../scripts/VERIFICATION.md).

Original local related-test fan-out evidence: two overlapping repository checks
plus UI journeys caused five-second unit timeouts and one-minute dev-server
startup failures. A 2026-09-30 Corruption refactor check passed 328 related
suites / 4,091 assertions in 538s. A repeat after a type-notation-only lint
correction ran for 1,233s before cancellation and reported five-second UI and
simulation timeouts; all six failing suites plus five affected suites passed
together with `--maxWorkers=1` (174 assertions, 70s). A standalone full-suite
comparison on 2026-09-30 took 237s with nine default workers and eight timeouts;
the same checkout with four workers passed in 77s.

On 2026-10-01, the five-player-bug handoff produced no dependency-related test
results before cancellation after 783s, then 416s on a retry with native bundler
threads limited. Host load averages were around 400. Focused one-worker tests
started and passed, but the complete handoff remained unverified. Diagnose host
contention and related-test collection before changing gameplay or test
timeouts; do not terminate another session's processes to obtain a passing gate.
