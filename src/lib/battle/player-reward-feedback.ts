import { mergeCombatText } from "./combat-text-events";
import { resolvePlayerHealing, type BattleState, type CombatTextEvent } from "./types";

export function emitOverhealBlockText(
  stateBefore: Pick<BattleState, "playerStatuses">,
  stateAfter: Pick<BattleState, "playerStatuses">,
  combatTexts: CombatTextEvent[],
) {
  if (stateAfter.playerStatuses.block <= stateBefore.playerStatuses.block) return;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "block",
    amount: stateAfter.playerStatuses.block - stateBefore.playerStatuses.block,
  });
}

export function emitReactiveThornsText(
  stateBefore: Pick<BattleState, "playerStatuses">,
  stateAfter: Pick<BattleState, "playerStatuses">,
  combatTexts: CombatTextEvent[],
) {
  const thornsGained = stateAfter.playerStatuses.thorns - stateBefore.playerStatuses.thorns;
  if (thornsGained <= 0) return;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "thorns",
    amount: thornsGained,
  });
}

export function resolveHealingWithFeedback(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  allowOverhealBlock = false,
) {
  const healing = resolvePlayerHealing(state, amount, allowOverhealBlock);
  if (combatTexts) {
    if (healing.effective > 0) {
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healing.effective });
    }
    emitOverhealBlockText(state, healing.state, combatTexts);
    emitReactiveThornsText(state, healing.state, combatTexts);
  }
  return healing;
}
