---
status: complete
updated: 2026-09-24
---

# Victory reward settlement

## Objective

Keep saved Gold and reward screen Gold in sync for every Campaign, Labyrinth,
and Wildwood victory. Today victory settlement and reward construction each
sum the same bonuses, so a new modifier can change only one total.

## Plan

- [x] Make victory Gold settlement the sole owner of bonus arithmetic and expose
      the amount earned after the multiplier to reward construction.
- [x] Change combat and boss reward constructors to accept an already settled
      Gold payout; keep their offer selection, Materials, and destinations intact.
- [x] Update the victory contract and focused tests so mode payouts and saved
      Gold agree, including multiplier math and an equipped Trinket bonus.
- [x] Update the architecture owner, review the diff, and run the task-owned
      handoff gate after archiving this plan.

## Notes

Keep durable rules in [Alchemy architecture](../../ARCHITECTURE.md#run-loop-overview).
For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change)
and [the plan lifecycle](../README.md#task-handoff).
