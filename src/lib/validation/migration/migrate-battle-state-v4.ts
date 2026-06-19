import type { RawSaveData } from "./types";

function migrateCombatFlagsV4(flags: RawSaveData): RawSaveData {
  const next = { ...flags };
  if (next.firstBurnTrinketDoubledUsed === true && next.firstBurnBoonDoubledUsed !== true) {
    next.firstBurnBoonDoubledUsed = true;
  }
  delete next.firstBurnTrinketDoubledUsed;
  return next;
}

/** v3→v4 battle snapshot renames (frozen). */
export function migrateBattleStateV4(battleState: unknown): unknown {
  if (!battleState || typeof battleState !== "object") return battleState;
  const state = battleState as RawSaveData;
  const next: RawSaveData = { ...state };

  if (!next.boonEffects && next.trinketEffects && typeof next.trinketEffects === "object") {
    next.boonEffects = next.trinketEffects;
  }
  delete next.trinketEffects;

  if (next.flags && typeof next.flags === "object") {
    next.flags = migrateCombatFlagsV4(next.flags as RawSaveData);
  }

  return next;
}
