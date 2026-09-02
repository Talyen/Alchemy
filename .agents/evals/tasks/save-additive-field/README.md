# Task: Save — additive field

Setup: Use an isolated eval worktree and add an optional persisted field with Zod `.default()` (no `CURRENT_SAVE_SCHEMA_VERSION` bump) per `MIGRATIONS.md` single-responsibility rule.

Goal: Schema + `defaults.ts` + legacy fixture updated together; old saves load; `activeRun` not dropped (idempotent `normalizeSaveData`).

Pass when:

- `npm run typecheck:all` passes
- `npm run docs:check` passes
- `test:ship:unit` (`save-migration-guard` + `save-migration-contract`) green
- New fixture round-trips idempotently

Run: `npm run verify -- src/lib/validation/save-schemas/active-run.ts src/features/alchemy/shared/storage/io.ts`
