# Active agent friction

Read only when the current task encounters a related failure or surprise. Current procedures belong in canonical owners, not this log.

Keep only unresolved recurring issues with their observation and next useful action.
When resolved, move reusable prevention to its canonical owner and delete the entry.
Routine fixes and completed investigations need no retained record.

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
processes. Prevention lives in
[the test policy](../CONTRIBUTING.md#what-to-run-when-you-change).
