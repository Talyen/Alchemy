import { useMemo } from "react";
import { getBattleCompanionDamageModifiers } from "@/lib/battle";
import type { BattleScreenState } from "./types";

export function useBattleDescriptionContext(state: BattleScreenState) {
  // Pass an explicit slice: if CompanionScalingState gains a field, this call
  // fails to typecheck until the slice (and therefore the deps below) is updated.
  const companionDamageModifiers = useMemo(
    () =>
      getBattleCompanionDamageModifiers({
        talentEffects: state.talentEffects,
        gearEffects: state.gearEffects,
        trinketEffects: state.trinketEffects,
        companionDamageBuff: state.companionDamageBuff,
        enemyCC: state.enemyCC,
        maxMana: state.maxMana,
        enemyHealth: state.enemyHealth,
        enemyMaxHealth: state.enemyMaxHealth,
      }),
    [
      state.talentEffects,
      state.gearEffects,
      state.trinketEffects,
      state.companionDamageBuff,
      state.enemyCC,
      state.maxMana,
      state.enemyHealth,
      state.enemyMaxHealth,
    ],
  );

  return useMemo(
    () => ({
      ...state.talentEffects,
      companionDamageModifiers,
    }),
    [state.talentEffects, companionDamageModifiers],
  );
}
