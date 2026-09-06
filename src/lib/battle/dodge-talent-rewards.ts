import { addPlayerStatusWithCombatText } from "./combat-text";
import { addForgeToPlayer, applyCleanseHeals } from "./status-player";
import type { BattleState, CombatTextEvent } from "./types";

export function applyDodgeTalentStatuses(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (state.talentEffects.forgeOnDodge > 0) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnDodge, combatTexts);
  }
  if (state.talentEffects.thornsOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", state.talentEffects.thornsOnDodge, combatTexts);
  }
  const amount = state.talentEffects.cleanseStacksOnDodge;
  if (amount <= 0) return nextState;

  const playerStatuses = { ...nextState.playerStatuses };
  let removedStatus = false;
  for (const status of ["burn", "poison", "bleed"] as const) {
    const previous = playerStatuses[status];
    playerStatuses[status] = Math.max(0, previous - amount);
    removedStatus ||= previous > 0 && playerStatuses[status] === 0;
  }
  nextState = { ...nextState, playerStatuses };
  return removedStatus ? applyCleanseHeals(nextState, combatTexts) : nextState;
}
