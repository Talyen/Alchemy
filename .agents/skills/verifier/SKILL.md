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

Inspect modified paths (`git status --short`) and run `npm run verify:changed -- --diff` (or an explicit path list). Use `--plan` to inspect the deduplicated route before running it; do not keep a second command table here.

### 2. Task Completion & Pre-Push Handoff Mode

When all implementation iterations are complete:

1. **Run Static Gates**:

   ```bash
   npm run typecheck
   npm run lint:boundaries
   npm run ci:routing
   ```

2. **Execute Full Pre-Push Check (for requested commits)**:
   - If the user requested a commit to `main`, execute:
     ```bash
     npm run check:push
     ```

3. **Format Readable Handoff Brief**:
   - Lead with domain/game outcome (what is true now, what was changed).
   - Report exact verification commands executed and pass/fail status.
   - Run `npm run docs:check:final`; active plans must be deleted unless the
     unfinished task is intentionally handed off with `--keep-plan`.
   - Do not paste raw build logs, test transcripts, or diff dumps into chat.
