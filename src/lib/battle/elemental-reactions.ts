import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { isPlayerDefeated, reduceEnemyArmor, setFlag, type BattleState, type CombatTextEvent } from "./types";
import { detonateEnemyStatuses } from "./dot-resolve";
import { mergeCombatText } from "./combat-text-events";
export function canInitiateElementalReaction(state: BattleState, context?: CardEffectResolutionContext): boolean {
  return (
    (!state.action || state.action.source === "companion") &&
    (context?.origin === undefined ||
      context.origin === "played-card" ||
      context.origin === "triggered-card" ||
      context.origin === "companion")
  );
}
export function canShatter(state: BattleState): boolean {
  return state.enemyCC.freezeSkipTurns > 0 && !state.flags.shatterUsed;
}
export function applyShatter(state: BattleState, texts: CombatTextEvent[]): BattleState {
  const { block, armor } = state.enemyMitigation;
  let next = reduceEnemyArmor(state, armor);
  next = { ...next, enemyMitigation: { ...next.enemyMitigation, block: 0 } };
  next = setFlag(next, "shatterUsed", true);
  mergeCombatText(texts, {
    target: "enemy",
    kind: "notice",
    stat: "physical",
    text: "Shatter · Critical",
  });
  if (block > 0)
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "block", amount: block, impact: false });
  if (armor > 0)
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "armor", amount: armor, impact: false });
  return next;
}
export function applyWildfire(state: BattleState, texts: CombatTextEvent[]): BattleState {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state) || state.enemyStatuses.burn <= 0 || state.flags.wildfireUsed)
    return state;
  const marked = setFlag(state, "wildfireUsed", true);
  mergeCombatText(texts, {
    target: "enemy",
    kind: "notice",
    stat: "burn",
    text: "Wildfire",
  });
  return detonateEnemyStatuses(marked, ["burn"], texts, "remaining-ticks");
}
