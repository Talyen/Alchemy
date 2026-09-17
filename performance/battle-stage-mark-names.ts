// Legacy alias: prefer importing from "@/lib/performance/marks" (or the
// battle-stage-marks shim) directly. Kept so perf scenarios don't churn.
export {
  BATTLE_STAGE_MARK_PREFIX,
  battleStageMarkName,
  type BattleStageMark,
} from "../src/lib/performance/battle-stage-marks";
export type { BattleStageMark as BattleStageMarkName } from "../src/lib/performance/battle-stage-marks";
