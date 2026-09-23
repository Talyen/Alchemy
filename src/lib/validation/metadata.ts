// Floor/current save contract: raising LAUNCH_SAVE_SCHEMA_VERSION retires
// formats and requires the migration-table pattern in
// features/alchemy/shared/storage/MIGRATIONS.md, pinned by
// tests/architecture/save-migration-contract.test.ts + save-migration-guard.test.ts.
export const LAUNCH_SAVE_SCHEMA_VERSION = 19;
export const CURRENT_SAVE_SCHEMA_VERSION = 20;

export { CURRENT_GAME_BUILD_VERSION } from "./metadata.generated";
export const CURRENT_CONTENT_VERSION = 3;
