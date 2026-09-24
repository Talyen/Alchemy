---
status: complete
updated: 2026-09-24
---

# Reward offer architecture

## Objective

Keep combat, boss, and Wildwood reward choices consistent while making their
eligibility and selection rules easier to change. Preserve the existing reward
state shape, seeded RNG sequence, settlement amounts, and public call sites.

## Plan

- [x] Move category availability, hoard guarantees, and choice sampling into one
      reward-offer owner with a discriminated result: each reward kind carries
      only the matching choice type.
- [x] Keep `reward-flow.ts` responsible for settlement and reward continuation;
      compose the offer with the existing persisted reward state there. Share
      the common boss/combat payout fields without changing callers.
- [x] Document the ownership boundary and verify existing reward selection,
      route, and victory behavior with task-scoped checks.

## Notes

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).
