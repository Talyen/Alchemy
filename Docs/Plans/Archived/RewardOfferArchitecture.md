---
status: complete
updated: 2026-09-24
---

# Reward offer architecture

`reward-offers.ts` owns category eligibility, hoard guarantees, and seeded choice sampling. `reward-flow.ts` adds settlement fields and continuation to the typed offer. This keeps combat, boss, and Wildwood choices consistent without changing the persisted reward shape, RNG sequence, payouts, or public call sites.

The implementation commit includes reward and route coverage; this archive does not retain a separate gate result.

Implementation: `c02a7f56`. Current ownership: [Run loop overview](../../ARCHITECTURE.md#run-loop-overview).
