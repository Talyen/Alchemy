---
status: complete
updated: 2026-09-24
---

# Balance sweep architecture

Paired comparisons now describe reference fights and variants separately from batch execution. `src/lib/balance/report-sweep-runner.ts` owns shared-reference reuse, match validation, and aggregation. This makes pair setup easier to inspect while preserving report rows, deterministic seeds, and public sweep entry points.

Focused sweep tests, source and test type checks, and the low-iteration balance report passed. The scoped handoff gate stopped at CI static checks because of an unrelated concurrent Options formatting failure; task-owned dead code found in that run was corrected.

Implementation: `81132e6c`. Current ownership: [Balance simulation](../../REFERENCE.md#balance-simulation).
