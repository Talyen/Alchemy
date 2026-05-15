// Battle-time trinket riders that are shared by card damage, status, and turn reducers.
// Depends only on state helpers and combat text merging to avoid effect-module import cycles.
import { PERCENT_DENOMINATOR } from "../game-constants";
import { addGold, applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text";

export function applyIronwoodBuckler(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.blockToArmorThreshold > 0 && state.playerStatuses.block >= state.trinketEffects.blockToArmorThreshold) {
    state = {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        armor: state.playerStatuses.armor + state.trinketEffects.blockToArmorAmount,
      },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount: state.trinketEffects.blockToArmorAmount });
  }
  return state;
}

export function applyBoneCharmHeal(state: BattleState, enemyWasAlive: boolean, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth <= 0 && enemyWasAlive && state.trinketEffects.boneCharmHealOnKill > 0) {
    const healAmount = state.trinketEffects.boneCharmHealOnKill;
    state = applyPlayerHealing(state, healAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  }
  return state;
}

export function applyLuckyCloverGold(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || damage <= 0) return state;
  if (Math.random() * PERCENT_DENOMINATOR < state.trinketEffects.luckyCloverGoldChance) {
    const nextState = addGold(state, damage);
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: damage });
    return nextState;
  }
  return state;
}
