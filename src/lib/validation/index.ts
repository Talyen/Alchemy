export {
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
  LAUNCH_SAVE_SCHEMA_VERSION,
} from "./metadata";
export {
  getCandidateSavedAt,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
  migrateSupportedSaveData,
} from "./migration/index";
export { normalizePersistedBattleState } from "./normalize-persisted-battle-state";
export {
  ActiveRunDataSchema,
  BattleCardSchema,
  CompletedDifficultiesSchema,
  ENEMY_STATUS_IDS_LIST,
  LabyrinthMapSchema,
  MaterialInventorySchema,
  SaveDataSchema,
  UnlockedTalentsSchema,
  isCombatGoldOverride,
  safeParseWithErrors,
  type ParsedActiveRunData,
  type ParsedSaveData,
} from "./save-schemas/index";

export { parseActiveRun, toActiveRunData } from "./parse-active-run";

export { legacyRunNeedsAbandonment } from "./migration";
