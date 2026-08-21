---
name: blast-radius
description: Existing-boundary impact guard. Auto-triggers when modifying existing shared stores, capability ports, persistence schemas, core game constants, or routing policy.
---

# Existing-boundary impact guard

## Trigger

Use for changes to an **existing** shared store/port, save contract, core constant, or navigation policy. Do not run when `architect` owns a new or structurally revised public contract.

## Steps

1. Read the exact route-selected owner section and identify the invariant being changed.
2. Search the touched subsystem first. Expand to known consumers only for a public symbol; do not repository-scan private helpers.
3. Note concrete save, transition, UI, or run-state effects that share the boundary.
4. Preview the changed-path route. The `verifier` skill owns commands and handoff gates.
