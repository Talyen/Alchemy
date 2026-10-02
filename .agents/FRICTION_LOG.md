# Active agent friction

Read only when the current task encounters a related failure or surprise. Current procedures belong in canonical owners, not this log.

Record unresolved recurring friction and consequential lessons with the observation and next useful action. Corrected typos, one-off environment issues, and self-explanatory fixes need no entry. When resolving an existing entry, preserve its useful evidence in [history](./history/README.md) and link reusable prevention in the canonical owner. Preserve existing history; do not create a record solely to log routine maintenance or reread resolved history routinely.

## Open

Steam overlay validation: steamworks.js 0.4 exposes neither overlay activation
callbacks nor availability detection. Desktop pauses on default Shift+Tab and
focus loss; custom chords and Deck overlay paths require real Steam evidence.
Upstream callback/availability work remains unmerged as checked on 2026-10-02.
The integration now uses the native callback when exposed, has no invalid second
callback pump, and uses the browser wishlist destination when availability is
unknown. See the [demo owner](../Docs/STEAM_DEMO.md#input-and-release-evidence)
for the minimal native-fork solution and hardware evidence matrix. Controller
backward focus uses F7 to avoid the existing Shift+Tab mapping collision.

Expensive test collection under unrelated host load remains unverified. Routine
overlap now stops before collection through the shared local test lane; default
handoff uses bounded Node smoke, and four-worker unit limits remain in place.
Raw CLI/watch sessions bypass the lane and must be coordinated manually. If a
single coordinated run still stalls, record collection timing and host pressure
before changing gameplay or test timeouts. Do not terminate another session's
processes. Original timeout evidence and the mitigation are preserved in
[October history](./history/friction-2026-10.md); prevention lives in
[the test policy](../CONTRIBUTING.md#what-to-run-when-you-change).

Scoped handoff checks can repeatedly fail their final source-staleness guard
while another session edits the shared checkout: three 2026-10-02 five-bug
checks passed smoke and selected-file formatting but observed different
checkout-wide digests at completion. The guard in `scripts/check.mjs` hashes
all dirty paths even when the check selects explicit task paths. Keep the
failed run evidence and retry after checkout writes settle; do not bypass the
guard or stop another session. The focused combat suites passed independently.

## Resolved history

[September 2026](./history/friction-2026-09.md). All previous resolved entries are preserved there.

[October 2026](./history/friction-2026-10.md) records Node Web Storage isolation
and the mitigation for overlapping expensive test runs.

The September history also records package-fixture isolation and native report-watcher
teardown recovery from the card-animation handoff. Prevention lives in
[the test policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) and the
[headless report server](../scripts/lib/vite-report-server.mjs).
