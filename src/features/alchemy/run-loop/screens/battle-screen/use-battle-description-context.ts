import { useMemo } from "react";
import {
  getBattleCompanionDamageModifiers,
  getBattleCardDescriptionInspection,
  getBattleCompanionDescriptionLines,
} from "@/lib/battle";
import { companionLibrary, type BattleCard, type CompanionId } from "@/lib/game-data";
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
        enemyCC: state.enemyCC,
        enemyStatuses: state.enemyStatuses,
        enemyHealth: state.enemyHealth,
        enemyMaxHealth: state.enemyMaxHealth,
      }),
    [
      state.talentEffects,
      state.gearEffects,
      state.trinketEffects,
      state.enemyCC,
      state.enemyStatuses,
      state.enemyHealth,
      state.enemyMaxHealth,
    ],
  );

  return useMemo(
    () => ({
      inspectBattleCard: (card: BattleCard) => getBattleCardDescriptionInspection(card, state),
      describeCompanion: (id: CompanionId) => getBattleCompanionDescriptionLines(companionLibrary[id], state),
      companionBondLevels: state.talentEffects.companionBondLevels,
      companionDamageModifiers,
    }),
    [state, companionDamageModifiers],
  );
}
