// Deprecated barrel — split into `run-lifecycle.ts` (persistence/lifecycle) and
// `run-presentation-lifecycle.ts` (UI listeners). Kept for backward compat; new code should
// import from the owning module directly.
export {
  restoreRun,
  resolveActiveRunForSave,
  snapshotRun,
  syncRunToBattleStart,
  syncBattleToRun,
  teardownRun,
  flushSaveAfterGearMutation,
  finalizeRunEndSession,
  applyRunDefeatTeardown,
} from "./run-lifecycle";
export {
  onRunTeardown,
  onClearBattlePresentation,
  clearBattleUi,
  clearBattlePresentationUi,
} from "./run-presentation-lifecycle";
