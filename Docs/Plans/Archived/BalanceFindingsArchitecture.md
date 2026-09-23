---
status: complete
updated: 2026-09-23
---

# Balance findings architecture

The current `src/lib/balance/findings.ts` mixes independent rule families in one
large module and passes a mutable callback between them. That makes it hard to
locate a finding rule or change one family without reading the whole pipeline.

1. Extract shared rate and median helpers, then move enemy/class equity,
   matchups, paired deltas, and anomalies into focused modules. Each collector
   returns an ordered `BalanceFinding[]`; the entry point concatenates them in
   the existing order before selection.
2. Keep finding IDs, text, thresholds, candidate order, selection, and the
   public `evaluateBalanceFindings` contract unchanged. Update the canonical
   architecture note to identify the new owners.
3. Run the balance findings tests and task-scoped handoff gate. Review the final
   diff, mark this plan complete, and archive it.
