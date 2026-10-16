// The development baseline supports the current format only. Freeze it when
// player progress is promised; later changes require the migration pattern in
// features/alchemy/shared/storage/MIGRATIONS.md, pinned by
// tests/architecture/save-migration-contract.test.ts + save-migration-guard.test.ts.
export const LAUNCH_SAVE_SCHEMA_VERSION = 21;
export const CURRENT_SAVE_SCHEMA_VERSION = 21;

export { CURRENT_GAME_BUILD_VERSION } from "./metadata.generated";
export const CURRENT_CONTENT_VERSION = 3;
