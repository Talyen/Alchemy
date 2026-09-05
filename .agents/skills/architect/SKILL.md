---
name: architect
description: Design new or structurally revised contracts across Alchemy feature boundaries, including capability ports, store schemas, persistence contracts, and screen-controller props. Excludes private helpers and ordinary use of existing contracts.
---

# Public-contract design

Read the relevant [architecture owner](../../../AGENTS.md#documentation-owners), then inspect the existing contract and its consumers before choosing a shape.

- Reuse the current owner when it can express the requirement. Introduce a new boundary only for a concrete consumer or invariant.
- Model valid states and operations in TypeScript before wiring handlers or React components. Check how each consumer will read, write, and handle failure; avoid speculative options and duplicate representations.
- For persisted changes, follow [MIGRATIONS.md](../../../src/features/alchemy/shared/storage/MIGRATIONS.md) for compatibility. For run commands, follow [run-state ownership](../../../docs/ARCHITECTURE.md#run-state) for atomicity and side effects.
- Update consumers and the canonical owner together. Use [verifier](../verifier/SKILL.md) for validation.

Ordinary changes within an existing contract follow [AGENTS.md](../../../AGENTS.md#change-guards) without a separate design workflow.
