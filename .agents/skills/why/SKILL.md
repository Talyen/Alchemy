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
   - Open the matching heading or checklist section first; expand only when the contract crosses a boundary:
     - Use the ownership table in `AGENTS.md` to select one owner (`ARCHITECTURE.md`, `WORKFLOWS.md`, `REFERENCE.md`, `MIGRATIONS.md`, or a cited audit), not all five.

2. **Inspect Unit Test Assertions**:
   - Search the nearest subsystem tests for assertions that document expected behavior; cap the first pass to matching symbols and filenames:
     ```bash
     rg "describe|it\(" tests/lib/battle/
     rg "describe|it\(" tests/features/alchemy/
     ```

3. **Query Git Commit Rationale (only when ambiguous)**:
   - If current docs and assertions do not answer the question, inspect at most the latest five relevant commits or a bounded line history:
     ```bash
     git log -n 5 -L <start>,<end>:<filepath>
     ```

4. **Synthesize & Validate Intent**:
   - Confirm that card `descriptionLines` match effect implementations, RNG uses `state.rng` / `Math.round()`, and run state writes preserve capability port contracts before applying changes.
