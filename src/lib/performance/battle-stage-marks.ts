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

export function markBattleStage(stage: BattleStageMark): void {
  try {
    performance.mark(battleStageMarkName(stage));
  } catch {}
}
