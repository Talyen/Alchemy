import { drawFromState, applyDrawResult } from "./draw";
import { rollTalentChance } from "./status-helpers";
import type { BattleState } from "./types";

export function applyBleedDamageDraw(state: BattleState, healthDamage: number): BattleState {
  if (healthDamage <= 0 || !rollTalentChance(state.talentEffects.drawOnBleedDamageChance, state)) {
    return state;
  }
  return applyDrawResult(state, drawFromState(state, 1));
}
