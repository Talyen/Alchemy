---
status: complete
updated: 2026-09-23
---

# Balance sweep architecture

## Objective

Make paired balance comparisons easier to inspect and harder to misconfigure, while preserving report rows, deterministic seeds, and all public sweep entry points. Scope is `src/lib/balance/` and its focused tests and documentation.

## Plan

- [x] Move batch configuration, paired execution, match validation, and aggregation into one runner with a typed reference/variant contract.
- [x] Convert each sweep into scenario groups that describe its reference fight and variants without running simulations directly.
- [x] Add focused coverage for reference reuse and pair invariants; retain the existing affix and card scenario coverage.
- [x] Document the owner, review the diff, run the focused balance checks, and attempt the repository handoff gate.

## Notes

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).

Focused sweep tests, source and test type checks, and the complete low-iteration balance report passed. The task-scoped handoff gate passed changed-path verification, documentation, and boundaries but stopped at CI static checks. Its task-owned unused export was removed and dead-code checks then passed. A concurrently edited Options screen test outside this plan still fails repository-wide formatting; it was left untouched.
