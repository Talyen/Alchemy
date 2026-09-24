---
status: complete
updated: 2026-09-24
---

# Balance findings architecture

The former findings module mixed independent rule families with a mutable callback. Focused collectors now own rates, equity, matchups, paired deltas, and anomalies; the entry point gathers their ordered candidates before selection. This makes a finding rule easier to locate while retaining IDs, text, thresholds, order, and the public `evaluateBalanceFindings` contract.

The implementation commit includes balance-finding coverage; this archive does not retain a separate gate result.

Implementation: `81132e6c`. Current owner: [Balance simulation](../../REFERENCE.md#balance-simulation).
