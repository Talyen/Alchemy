# Save Migration Contract

Status: active
Confidence: high

## Observation

Save shape changes that edit Zod schemas/defaults without bumping `CURRENT_SAVE_SCHEMA_VERSION`, adding fixtures, and asserting gameplay outcomes break load for players on supported builds. Stamp-only vs transform decision is frequently misapplied.

## Why it matters

After public launch `LAUNCH_SAVE_SCHEMA_VERSION` freezes; every bump `>= launch` is a commitment that any supported save loads and remains playable. CI enforces contract; missing fixture or silent `activeRun` drop fails `test:ship:unit`.

## Evidence

- `src/features/alchemy/shared/storage/MIGRATIONS.md` — single-responsibility rule, when to bump, required pattern, progression gate fields, future-version protection.
- `src/lib/validation/metadata.ts` — `LAUNCH_SAVE_SCHEMA_VERSION` / `CURRENT_SAVE_SCHEMA_VERSION`.
- `src/lib/validation/migration/index.ts` — `migrateSaveDataToCurrent` stamping + chaining.
- `src/lib/validation/migration/content-steps.ts` + `steps-*.ts` — versioned transforms.
- `tests/fixtures/legacy-saves.ts` — `CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION` must cover `LAUNCH … N-1`.
- `tests/architecture/save-migration-guard.test.ts` + `save-migration-contract.test.ts` — gameplay assertions (collection, talents, homestead, `activeRun` not dropped, parked runs, battle trinket/gear manifests, interruptedFlow, hex floors).
- `src/features/alchemy/shared/storage/io.ts` — `safeParseWithErrors` production path vs `normalizeSaveData` test path.

## Preferred pattern

1. Decide bump vs additive default (Zod `.default()`/`.catch()` — no bump) per `MIGRATIONS.md`.
2. For `N → N+1`: increment `CURRENT_SAVE_SCHEMA_VERSION`, add `migrateVNToVNPlus1`, chain in `migrateSaveDataToCurrent`, update Zod + `defaults.ts`, add fixture, extend `MIGRATION_SCENARIO_FIXTURES` if `activeRun` touched.
3. Add tombstoned card IDs to `tombstoned-content-ids.ts` when removing catalog entries; hydrate drops unknown cards silently.
4. Run `npm run check:ship` (covers `test:ship:unit` + `lint:ci` + `build:desktop`). Keep `activeRun` idempotent after `normalizeSaveData`.

## Exceptions

- Additive nested fields with Zod defaults (e.g., `activeRun.rng`, `pendingBattleTransition`, `discoveredUniqueIds`) — stamp-only, no step.
- Pre-launch floor raises that intentionally drop prior triads (schema 11 `resumePhase` → `interruptedFlow`, schema 14 grid → hex) — documented, non-silent regeneration.

## Enforcement opportunity

Strongest: tests `save-migration-guard.test.ts` / `save-migration-contract.test.ts` (already ratcheted). Further: tombstone guard + `docs:check` migration fixture completeness. Prose rule should never replace test gate.
