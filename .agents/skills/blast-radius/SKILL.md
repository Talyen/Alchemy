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
   - Perform scoped symbol searches across `src/` to identify dependent screens, controllers, and hooks:
     ```bash
     rg "SymbolName" src/
     ```

4. **Map Blast Radius & Test Matrix**:
   - Identify affected subsystem test suites per `CONTRIBUTING.md § What to run when you change…`.
   - List potential save-compatibility, UI transition, or run-state side effects before writing edits.
