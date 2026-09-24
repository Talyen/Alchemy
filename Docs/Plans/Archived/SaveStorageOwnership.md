---
status: complete
updated: 2026-09-24
---

# Save storage ownership

Separate module-global transport and queue state allowed queued work to observe a changed backend. `SaveStorage` now owns transport, queue, write protection, load, exit, and clear for one instance; the app API delegates to a private instance. Backend configuration is rejected while operations are pending.

Save formats, coalescing, timestamps, cancellation, and exit ordering remain unchanged. Focused tests passed 36 checks, and the complete changed-path handoff gate passed, including persistence tests, static checks, web build, bundle budget, and preview smoke.

Implementation: `ff9299be`. Current owner: [Persistence API](../../RUN_STATE.md#persistence-api).
