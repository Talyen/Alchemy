// Public lifecycle boundary for feature code. The transition implementation
// remains private to shared/stores so callers cannot bypass orchestration.
export {
  restoreRun,
  snapshotRun,
  teardownRun,
  syncRunToBattleStart,
  syncBattleToRun,
  syncRunMaxHealthFromGearMutation,
  clearBattleUi,
  clearBattlePresentationUi,
  finalizeRunEndSession,
  applyRunDefeatTeardown,
  resolveActiveRunForSave,
  flushSaveAfterGearMutation,
  onRunTeardown,
  onClearBattlePresentation,
} from "./run-transitions";
export { hydrateModeRunInDraft } from "./run-park-restore";
