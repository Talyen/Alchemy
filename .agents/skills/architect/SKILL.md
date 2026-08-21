---
name: architect
description: Public-contract design guard. Auto-triggers only when adding or structurally revising a cross-boundary type, capability port, store schema, persistence contract, or screen-controller contract.
---

# Public-contract design guard

## Trigger

Use for a **new or structurally revised public contract** imported across a feature boundary. Do not trigger for ordinary implementation, a private helper, test-only types, or a change to an existing contract that does not redesign its shape; `blast-radius` owns those existing-boundary changes. Never run both skills for the same change.

## Steps

1. Read the exact route-selected owner section.
2. Draft the smallest honest TypeScript contract before concrete React/handler code. Keep invalid states out of the model and comments limited to non-obvious invariants.
3. Search only the public symbol’s known consumers and boundary entry points; expand when evidence shows another owner.
4. Preview the changed-path route. The `verifier` skill owns commands and handoff gates.
