// Trinket-specific battle effects: Ironwood Buckler and Bone Charm.
import { applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
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
  if (state.enemyHealth <= 0 && enemyWasAlive && state.trinketEffects.boneCharmHealOnKill > 0 && !state.flags.boneCharmUsed) {
    const healAmount = state.trinketEffects.boneCharmHealOnKill;
    state = {
      ...state,
      flags: { ...state.flags, boneCharmUsed: true },
    };
    state = applyPlayerHealing(state, healAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  }
  return state;
}
