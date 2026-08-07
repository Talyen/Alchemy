// Public lifecycle boundary for feature code. The transition implementation
// remains private to shared/stores so callers cannot bypass orchestration.
export {
  restoreRun,
  snapshotRun,
  teardownRun,
  syncRunToBattleStart,
  syncBattleToRun,
  clearBattleUi,
  clearBattlePresentationUi,
  finalizeRunEndSession,
  applyRunDefeatTeardown,
  resolveActiveRunForSave,
  onRunTeardown,
  onClearBattlePresentation,
} from "./run-transitions";
