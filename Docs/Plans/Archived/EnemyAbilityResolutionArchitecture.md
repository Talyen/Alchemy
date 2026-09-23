---
status: complete
updated: 2026-09-23
---

# Enemy ability resolution architecture

## Objective

Make enemy abilities easier to change without altering damage, trait reward,
reaction, RNG, or combat text order. Keep the existing public ability entry points.

## Plan

- [x] Keep `enemy-turn-attack.ts` as the ability-selection and effect-sequencing owner.
- [x] Move damage calculation and once-per-ability hit rewards to a private damage module.
- [x] Move post-ability trait follow-ups to a private follow-up module, sharing one
      explicit per-ability context and hit recorder with the damage and sequence owners.
- [x] Document the stage ownership in the battle rules, review the final diff,
      run focused enemy ability tests, and run the task-owned handoff gate.

## Notes

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).
