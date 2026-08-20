---
name: blast-radius
description: Impact & Dependency Fan-out Analyzer. Auto-triggers when touching shared stores, run-session capability ports, persistence schemas, or core game constants. Evaluates import boundaries and symbol usage before edits are applied.
---

# Blast Radius Impact Analysis (Alchemy)

Evaluate downstream impact, import boundaries, and dependency fan-out before modifying run state capability ports, shared stores, persistence contracts, or core game constants in Alchemy.

## Trigger Scenarios

Auto-triggers when:

- Editing files in `src/features/alchemy/shared/stores/` or `run-session-*.ts` capability ports.
- Modifying save schemas (`src/lib/validation/save-schemas/`), storage contracts (`MIGRATIONS.md`), or `active-run.ts`.
- Altering core game constants in `src/lib/game-constants/`.
- Changing route definitions or navigation policies in `src/lib/routing/`.

## Execution Steps

1. **Identify Boundary Seams & Ports**:
   - Check if touched code involves capability ports (`run-session-react-ports`, `run-session-write-port`, `run-session-read-port`, `run-session-lifecycle-port`).
   - Ensure gameplay writes go through `run-session-write-port.ts` and commits pass through `dispatchRunSessionCommand()`.

2. **Check Import Boundaries**:
   - Run boundary linting to verify layer rules:
     ```bash
     npm run lint:boundaries
     ```

3. **Trace Symbol Dependents**:
   - Search the touched subsystem first, then expand to known consumers only when the symbol is public. Avoid a repository-wide scan for private helpers:
     ```bash
     rg -l "SymbolName" <touched-directory> src/app src/features/alchemy/shell
     ```

4. **Map Blast Radius & Test Matrix**:
   - Identify affected subsystem test suites with `npm run verify:changed -- --plan <paths>`; the executable route catalog owns the command list.
   - List potential save-compatibility, UI transition, or run-state side effects before writing edits.
