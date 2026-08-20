---
name: verifier
description: Verification Gate & Test Router. Auto-triggers post-edit for fast localized test routing, and prior to final task handoff for static typechecking, boundary linting, pre-push validation, and formatting a concise handoff summary.
---

# Alchemy Verification Gate & Test Router

Route and execute path-scoped tests during active development, and enforce static compilation, boundary linting, and pre-push validation prior to final task completion.

## Trigger Scenarios

Auto-triggers when:

- **Fast Iteration Mode**: Code edits have been applied during active development and need localized test validation.
- **Full Handoff Mode**: Implementation is complete, and preparing final handoff or requested commits.

## Execution Steps

### 1. Mid-Task Fast Iteration Mode

Inspect modified paths (`git diff --name-only HEAD`) and route to localized test suites per [`CONTRIBUTING.md § What to run when you change...`](../../../CONTRIBUTING.md#what-to-run-when-you-change):

- **Active run / screen / bootstrap** (`shared/stores/`, `shell/`, `fade-slot.tsx`):
  ```bash
  npm test -- tests/app/use-alchemy-bootstrap.test.ts tests/features/alchemy/shared/stores/ tests/features/alchemy/shared/ui/
  npm run lint:boundaries
  ```
- **Save / persistence** (`shared/storage/`, `save-schemas/`, `active-run.ts`):
  ```bash
  npm test -- tests/features/alchemy/shared/storage tests/features/alchemy/app/autosave-hook.test.ts
  ```
- **Battle / cards** (`src/lib/battle/`, `src/lib/game-data/`, `run-loop/battle/`):
  ```bash
  npm test -- tests/lib/battle tests/features/alchemy/run-loop/battle tests/lib/game-data/descriptions-match-effects.test.ts
  ```
- **Shop / Rewards** (`run-loop/shop/`, `screens/*shop*`):
  ```bash
  npm test -- tests/features/alchemy/run-loop/shop
  ```
- **Audio / SFX** (`src/lib/audio*.ts`, `sound-registry.ts`):
  ```bash
  npm test -- tests/lib/audio-sfx.test.ts tests/lib/sound-assets.test.ts
  ```

### 2. Task Completion & Pre-Push Handoff Mode

When all implementation iterations are complete:

1. **Run Static Gates**:

   ```bash
   npm run typecheck
   npm run lint:boundaries
   ```

2. **Execute Full Pre-Push Check (for requested commits)**:
   - If the user requested a commit to `main`, execute:
     ```bash
     npm run check:push
     ```

3. **Format Readable Handoff Brief**:
   - Lead with domain/game outcome (what is true now, what was changed).
   - Report exact verification commands executed and pass/fail status.
   - Do not paste raw build logs, test transcripts, or diff dumps into chat.
