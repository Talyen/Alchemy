# Run-State Command Boundary

Status: enforced-rationale
Confidence: high

Why: bypassing the single-draft command boundary causes torn reads, unpersisted writes, and non-rollbackable effects.

Owner: [ARCHITECTURE.md](../../../Docs/RUN_STATE.md#run-state) owns the aggregate, ports, and `afterCommit` contract.

Enforcement: boundary lint (`DOMAIN_STORE_PATTERNS`, `AGGREGATE_NO_DIRECT_MUTATION`) keeps `gameplay-state-store.ts` internal.
