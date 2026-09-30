# Active agent friction

Read only when the current task encounters a related failure or surprise. Current procedures belong in canonical owners, not this log.

Record unresolved recurring friction and consequential lessons with the observation and next useful action. Corrected typos, one-off environment issues, and self-explanatory fixes need no entry. When resolving an existing entry, preserve its useful evidence in [history](./history/README.md) and link reusable prevention in the canonical owner. Preserve existing history; do not create a record solely to log routine maintenance or reread resolved history routinely.

## Open

Steam overlay validation: steamworks.js 0.4 exposes neither overlay activation
callbacks nor availability detection. Desktop pauses on default Shift+Tab and
focus loss; custom chords and Deck overlay paths require real Steam evidence.
Upstream callback/availability work remains unmerged. See the [demo owner](../Docs/STEAM_DEMO.md#input-and-release-evidence)
for the release gate and next action. Controller backward focus uses F7 to avoid
the existing Shift+Tab mapping collision.

Node 24 Web Storage: its experimental global `localStorage` getter returns undefined
without `--localstorage-file` and shadows JSDOM storage in Vitest. Focused DOM
checks pass with `NODE_OPTIONS=--no-experimental-webstorage`, which lets JSDOM own
test storage. Use that local invocation on affected Node versions; no Node
storage file or product save change is needed. A permanent runtime/test-environment
compatibility fix remains separate from the Options change.

Local related-test fan-out: two overlapping repository checks plus UI journeys
caused five-second unit timeouts and one-minute dev-server startup failures.
Dependency-related verification now uses the existing four-worker budget in
[verification test commands](../scripts/lib/verification/test-commands.mjs).
Browser journeys should still run serially after broad unit verification.

## Resolved history

[September 2026](./history/friction-2026-09.md). All previous resolved entries are preserved there.

The September history also records package-fixture isolation and native report-watcher
teardown recovery from the card-animation handoff. Prevention lives in
[the test policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) and the
[headless report server](../scripts/lib/vite-report-server.mjs).
