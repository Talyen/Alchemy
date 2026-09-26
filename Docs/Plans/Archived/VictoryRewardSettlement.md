---
status: complete
updated: 2026-09-25
---

# Victory reward settlement

Victory settlement now calculates Gold once and passes the settled payout to
reward construction. Campaign, Labyrinth, and Wildwood reward screens therefore
show the amount committed to the purse, including multipliers and equipped
Trinket bonuses. Offer selection, Materials, destinations, and the saved reward
shape retain their existing owners and behavior.

The implementation commit includes focused victory settlement coverage; this
record retains no separate handoff-gate result.

Implementation: `fc67516a`. Current owner: [Run loop overview](../../ARCHITECTURE.md#run-loop-overview).
