# Save Migration Contract

Status: enforced-rationale
Confidence: high

Why: disagreeing schemas, defaults, migrations, and fixtures break supported saves.

Owner: [MIGRATIONS.md](../../../src/features/alchemy/shared/storage/MIGRATIONS.md) owns the bump-vs-additive decision and required pattern.

Enforcement: `save-migration-guard` / `save-migration-contract` tests; see the [version decision](../../../src/features/alchemy/shared/storage/MIGRATIONS.md#when-to-increment).
