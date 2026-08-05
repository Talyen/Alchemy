import type { BattleStageMark } from "../src/lib/performance/battle-stage-marks";

/** Keep in sync with `BATTLE_STAGE_MARK_PREFIX` in src/lib/performance/battle-stage-marks.ts. */
const BATTLE_STAGE_MARK_PREFIX = "alchemy:battle:";

export type BattleStageMarkName = BattleStageMark;

export function battleStageMarkName(stage: BattleStageMark): string {
  return `${BATTLE_STAGE_MARK_PREFIX}${stage}`;
}
