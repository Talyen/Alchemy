/** User Timing mark names for battle end-turn profiling (app + perf harness). */

const BATTLE_STAGE_MARK_PREFIX = "alchemy:battle:";

export type BattleStageMark =
  | "discard-start"
  | "discard-end"
  | "resolve-start"
  | "resolve-end"
  | "enemy-start"
  | "enemy-end"
  | "draw-start"
  | "draw-end";

function battleStageMarkName(stage: BattleStageMark): string {
  return `${BATTLE_STAGE_MARK_PREFIX}${stage}`;
}

/**
 * Record a battle pipeline stage for the on-demand perf harness.
 * Do not clear prior marks — harness waits use cumulative / baseline-relative counts.
 */
export function markBattleStage(stage: BattleStageMark): void {
  try {
    performance.mark(battleStageMarkName(stage));
  } catch {
    // performance.mark unavailable in some test environments
  }
}
