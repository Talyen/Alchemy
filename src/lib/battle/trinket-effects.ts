import type { BattleState, CombatTextEvent } from "./types";
import { addGoldWithCombatText, applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { getBattleRng, rollPercent } from "./status-helpers";

export function applyIronwoodBuckler(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (
    state.trinketEffects.blockToArmorThreshold > 0 &&
    state.playerStatuses.block >= state.trinketEffects.blockToArmorThreshold
  ) {
    state = {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        armor: state.playerStatuses.armor + state.trinketEffects.blockToArmorAmount,
      },
    };
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "armor",
      amount: state.trinketEffects.blockToArmorAmount,
    });
  }
  return state;
}

export function applyBoneCharmHeal(state: BattleState, enemyWasAlive: boolean, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth <= 0 && enemyWasAlive && state.trinketEffects.boneCharmHealOnKill > 0) {
    state = applyHealingWithCombatText(state, state.trinketEffects.boneCharmHealOnKill, combatTexts);
  }
  return state;
}

export function applyLuckyCloverGold(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || damage <= 0) return state;
  if (rollPercent(state.trinketEffects.luckyCloverGoldChance, getBattleRng(state))) {
    return addGoldWithCombatText(state, damage, combatTexts);
  }
  return state;
}
