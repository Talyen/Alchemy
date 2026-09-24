---
status: complete
updated: 2026-09-24
---

# Battle feedback ownership

Combat feedback rules, timers, and identities formerly shared the presentation store's hand and snapshot state. A per-store feedback owner now prepares action batches and owns expiry, shakes, telegraphs, and cancellation. The presentation store keeps its public API and resets visible state after cancelling that lifetime.

Gameplay, saves, motion timing, and controller contracts are unchanged. The existing presentation tests passed unchanged; three lifetime and reset tests were added, and the focused run passed 32 tests. The original record did not retain a separate final handoff result.

Implementation: `ff9299be`. Current owner: [Battle controller data flow](../../BATTLE_CONTROLLERS.md#data-flow).
