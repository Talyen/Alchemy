/**
 * Resolves passive, combat-time trinket triggers.
 * Depends on: types.ts, combat-text.ts, game-constants.ts.
 * Depended on by: damage.ts, enemy-turn.ts, status-effects.ts.
 */
import { PERCENT_DENOMINATOR } from "../game-constants";
import { addGold, applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";

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
    const healAmount = state.trinketEffects.boneCharmHealOnKill;
    const prevState = state;
    state = applyPlayerHealing(state, healAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
    emitOverhealBlockText(prevState, state, combatTexts);
  }
  return state;
}

export function applyLuckyCloverGold(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || damage <= 0) return state;
  if (state.rng() * PERCENT_DENOMINATOR < state.trinketEffects.luckyCloverGoldChance) {
    const nextState = addGold(state, damage);
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: damage });
    return nextState;
  }
  return state;
}
