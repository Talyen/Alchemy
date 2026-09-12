import { useMemo } from "react";
import { getBattleCompanionDamageModifiers } from "@/lib/battle";
import type { BattleScreenState } from "./types";

export function useBattleDescriptionContext(state: BattleScreenState) {
  return useMemo(
    () => ({
      ...state.talentEffects,
      companionDamageModifiers: getBattleCompanionDamageModifiers(state),
    }),
    [state],
  );
}
