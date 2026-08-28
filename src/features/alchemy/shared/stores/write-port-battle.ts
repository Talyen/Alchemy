// Deprecated shim — battle mutators now live in write-port-run.ts.
// Keep for one cycle; new code should import via run-session-write-port or write-port-run.
export {
  withRestingWorldBattleRng,
  withRestingEndPlayerTurnResolution,
  setSyncedBattleState,
  setBattleState,
  clearPendingTransitionResumeRequired,
  setDisplayOverrides,
  setBattleStartState,
  setHasActiveBattle,
  initializeActiveBattle,
  commitBattleTransition,
  beginBattleTransition,
  clearBattleTransition,
} from "./write-port-run";
export type { DisplayOverrides } from "./run-domain-types";
