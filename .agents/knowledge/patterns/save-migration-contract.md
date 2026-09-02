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

## Resolution

[MIGRATIONS.md](../../../src/features/alchemy/shared/storage/MIGRATIONS.md)
owns the bump-vs-additive decision, required pattern, and progression gate
fields. The `save-migration-guard` / `save-migration-contract` tests plus the
tombstone guard enforce gameplay outcomes; prose never replaces those gates.
