import { useMemo } from "react";
import type { BattleScreenState } from "./types";

export function useBattleDescriptionContext(state: BattleScreenState) {
  return useMemo(
    () => ({
      ...state.talentEffects,
      companionDamageBonus: state.trinketEffects.companionDamageBonus,
      companionDamageBuff: state.companionDamageBuff,
    }),
    [state.talentEffects, state.trinketEffects.companionDamageBonus, state.companionDamageBuff],
  );
}
