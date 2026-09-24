---
status: complete
updated: 2026-09-24
---

# Battle reward ownership

## Objective

Make battle reward rules findable without treating combat text as their owner. Keep
the current player-facing rewards and reaction order, including healing from
defeat and Blood Countess's response to actual Health restoration.

## Plan

- [x] Extract shared Health resolution and feedback from the coupled reward
      reactions, preserving the difference between ordinary and defeat healing.
- [x] Move the coupled player reward rules to a named gameplay owner. Send
      callers directly to it, `combat-text-events`, or `enemy-healing`; remove
      the misleading `combat-text` facade.
- [x] Update the battle architecture owner and focused tests for healing,
      reaction order, and exactly-once defeat payouts.
- [x] Review the diff and run the task-scoped `npm run check` gate.

## Notes

The reward reactions remain co-located because Health, cleanse, Block, Armor,
Gold, and defeat rewards call into one another. Splitting those reactions by
resource would introduce circular module dependencies. The extracted Health
primitive has no reward dependencies.

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).
