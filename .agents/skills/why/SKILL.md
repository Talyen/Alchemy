---
name: why
description: Intent & Context Recovery Engine. Auto-triggers when refactoring BattleState, card effect descriptions, material rewards, or save persistence contracts. Synthesizes docs, test assertions, and git history to recover rationale before changes.
---

# Context & Intent Recovery Engine (Alchemy)

Recover historical rationale and architectural intent before modifying established game mechanics, `BattleState` rules, material reward flows, card descriptions, or persistence schemas.

## Trigger Scenarios

Auto-triggers when:

- Modifying `BattleState` resolution, combat formulas, or turn ordering.
- Changing card definitions (`descriptionLines` parity with card effect handlers).
- Altering material rewards (`awardMaterialsDuringRun()` vs `addMaterials()`).
- Modifying save persistence schemas, hydration snapshots, or `MIGRATIONS.md`.

## Execution Steps

1. **Search Subsystem Documentation**:
   - Check matching docs in `docs/`:
     - Architecture & ports: `docs/ARCHITECTURE.md`
     - Workflows (saves, cards, materials, motion): `docs/WORKFLOWS.md`
     - Battle glossary & constants: `docs/REFERENCE.md`
     - Persistence contracts: `src/features/alchemy/shared/storage/MIGRATIONS.md`
     - Audits: `docs/Audits/README.md`

2. **Inspect Unit Test Assertions**:
   - Search Vitest unit tests for assertions that document expected behavior:
     ```bash
     rg "describe|it\(" tests/lib/battle/
     rg "describe|it\(" tests/features/alchemy/
     ```

3. **Query Git Commit Rationale**:
   - Inspect commit history for target lines to recover rationale:
     ```bash
     git log -n 5 -L <start>,<end>:<filepath>
     ```

4. **Synthesize & Validate Intent**:
   - Confirm that card `descriptionLines` match effect implementations, RNG uses `state.rng` / `Math.round()`, and run state writes preserve capability port contracts before applying changes.
