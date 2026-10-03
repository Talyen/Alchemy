import { useMemo } from "react";
import { projectEnemyDotDamage } from "@/lib/battle";
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
      reactionPreview: {
        shatter: state.flags.shatterUsed
          ? "Shatter: used this turn."
          : state.enemyCC.freezeSkipTurns > 0
            ? `Shatter: destroy all ${state.enemyMitigation.block} Block and ${state.enemyMitigation.armor} Armor. Guaranteed Critical. Freeze remains.`
            : "Shatter: a Physical hit against a Frozen enemy destroys all Block and Armor and guarantees a Critical. Once per turn.",
        wildfire: state.flags.wildfireUsed
          ? "Wildfire: used this turn."
          : state.enemyStatuses.burn > 0
            ? `Wildfire: detonate ${projectEnemyDotDamage({ enemyStatuses: state.enemyStatuses, enemyCC: state.enemyCC, currentEnemy: state.currentEnemy, talentEffects: state.talentEffects, gearEffects: state.gearEffects, encounterBenefits: state.encounterBenefits }, "burn", "remaining-ticks")} remaining Burn damage; remove Burn. Requires a damaging Nature hit and a surviving hero and enemy.`
            : "Wildfire: a damaging Nature hit against a Burning enemy detonates its remaining Burn. Once per turn.",
      },
    }),
    [
      state.talentEffects,
      companionDamageModifiers,
      state.flags,
      state.enemyCC,
      state.enemyMitigation,
      state.enemyStatuses,
      state.currentEnemy,
      state.gearEffects,
      state.encounterBenefits,
    ],
  );
}
