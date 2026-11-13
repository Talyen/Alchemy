export const STARTUP_READY_MARK = "alchemy:startup:ready";

export function markStartupReady(): void {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
  try {
    if (
      typeof performance.getEntriesByName !== "function" ||
      performance.getEntriesByName(STARTUP_READY_MARK, "mark").length === 0
    ) {
      performance.mark(STARTUP_READY_MARK);
    }
  } catch {}
}

const BATTLE_STAGE_MARK_PREFIX = "alchemy:battle:";

const BATTLE_STAGES = [
  "discard-start",
  "discard-end",
  "resolve-start",
  "resolve-end",
  "enemy-start",
  "enemy-end",
  "draw-start",
  "draw-end",
] as const;

export type BattleStageMark = (typeof BATTLE_STAGES)[number];

export function clearBattleStageMarks(): void {
  if (typeof performance === "undefined" || typeof performance.clearMarks !== "function") return;
  try {
    for (const stage of BATTLE_STAGES) performance.clearMarks(battleStageMarkName(stage));
  } catch {}
}

export function battleStageMarkName(stage: BattleStageMark): string {
  return `${BATTLE_STAGE_MARK_PREFIX}${stage}`;
}

export function markBattleStage(stage: BattleStageMark): void {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
  try {
    performance.mark(battleStageMarkName(stage));
  } catch {}
}
