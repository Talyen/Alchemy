import type { DamageType } from "@/lib/game-data";
import { gainManaWithCombatText } from "./player-rewards";
import { rollTalentChance } from "./status-helpers";
import type { BattleState, CombatTextEvent } from "./types";

export function applyElementalDamageManaRestore(
  state: BattleState,
  damageType: DamageType,
  healthDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    healthDamage <= 0 ||
    state.mana >= state.maxMana ||
    state.gearEffects.elementalDamageManaChance <= 0 ||
    (damageType !== "burn" && damageType !== "freeze" && damageType !== "holy")
  )
    return state;
  return rollTalentChance(state.gearEffects.elementalDamageManaChance, state)
    ? gainManaWithCombatText(state, 1, combatTexts, { skipFightPacing: true })
    : state;
}
