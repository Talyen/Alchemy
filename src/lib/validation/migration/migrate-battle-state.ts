import type { RawSaveData } from "./types";

function migrateCombatFlags(flags: RawSaveData): RawSaveData {
  const next = { ...flags };
  if (next.firstBurnTrinketDoubledUsed === true && next.firstBurnBoonDoubledUsed !== true) {
    next.firstBurnBoonDoubledUsed = true;
  }
  delete next.firstBurnTrinketDoubledUsed;
  return next;
}

/** Renames legacy battle snapshot fields. Idempotent for already-migrated saves. */
export function migrateBattleState(battleState: unknown): RawSaveData | unknown {
  if (!battleState || typeof battleState !== "object") return battleState;
  const state = battleState as RawSaveData;
  const next: RawSaveData = { ...state };

  if (!next.boonEffects && next.trinketEffects && typeof next.trinketEffects === "object") {
    next.boonEffects = next.trinketEffects;
  }
  delete next.trinketEffects;

  if (next.flags && typeof next.flags === "object") {
    next.flags = migrateCombatFlags(next.flags as RawSaveData);
  }

  return next;
}
