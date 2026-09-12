---
status: complete
updated: 2026-09-11
implementation: c2d06be6
---

# Save write acknowledgement

## Decision and rationale

Implemented in `c2d06be6`. Save outcomes flow through the existing coalescing
queue as `saved`, `failed`, or `skipped`. Autosave keeps progress pending until
local storage acknowledges that snapshot or a covering newer one. Revision-based
acknowledgement prevents an older completion from clearing newer progress.

Previously, autosave cleared its dirty state before storage completed, and failed
writes resolved without an outcome. A temporary failure could therefore suppress
later retries and exit saves. The fix reused one timer for debounce and a
10-second failure cooldown; new changes cannot bypass that cooldown, while exit
signals may flush immediately. Queue tests replaced real sleeps with deferred gates.

## Compatibility

Local success remains success when cloud mirroring fails. Browser exit writes
remain synchronous; desktop IPC stays serialized and shutdown remains best effort.
Clear, protection, disabled persistence, and cleanup cancel old acknowledgements
and retries; late completions cannot restart cancelled work. Overlapping clears
remain protected until all clear operations complete.

No saved scheduling metadata, schema change, new warning, or quit-blocking UI was
introduced. The current contract and subsequent scheduling refactor are owned by
[the save guide](../../../src/features/alchemy/shared/storage/MIGRATIONS.md#policy-local-is-authoritative).

## Verification recorded at implementation

Three baseline suites passed 12 tests but did not establish failure recovery.
Final regressions covered failed and thrown writes, recovery without new changes,
exit flushes, overlapping revisions, coalesced acknowledgements, failure cooldown,
clear/protection/cleanup cancellation, and non-fatal cloud failure.

Task-scoped handoff `check-20260907t201235z-3110-e58ac2` passed documentation,
related and changed tests, save/persistence tests, CI static checks, the web build,
and preview smoke. Desktop packaging and lockfile checks were not applicable.
