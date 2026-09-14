import { useMemo } from "react";
import { getBattleCompanionDamageModifiers } from "@/lib/battle";
import { LOW_HEALTH_THRESHOLD_PERCENT, PERCENT_DENOMINATOR } from "@/lib/game-constants";
import type { BattleScreenState } from "./types";

export function useBattleDescriptionContext(state: BattleScreenState) {
  const freezeFrozen = state.enemyCC.freezeSkipTurns > 0;
  const isEnemyLowHealth =
    state.enemyHealth < (state.enemyMaxHealth * LOW_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR;

  const companionDamageModifiers = useMemo(
    () => getBattleCompanionDamageModifiers(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granularly depend only on the fields that affect companion scaling
    [
      state.talentEffects,
      state.gearEffects.companionDamageBonus,
      state.trinketEffects.companionDamageBonus,
      state.companionDamageBuff,
      freezeFrozen,
      state.maxMana,
      isEnemyLowHealth,
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
