import {
  computeCardPayment,
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  isAttackCard,
  type BattleSnapshot,
} from "@/lib/battle";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { shouldPreserveConsumable } from "./brewing-policy";
import type { CareerConfig, PlayerChoice } from "./types";

function convertsManaToDefense(effects: readonly BattleCardEffect[]): boolean {
  return effects.some((effect) => {
    if (effect.kind === "chance")
      return convertsManaToDefense(effect.successEffects) || convertsManaToDefense(effect.failureEffects);
    return (
      effect.kind === "player-status" &&
      effect.convertCurrentMana !== undefined &&
      (effect.status === "block" || effect.status === "armor")
    );
  });
}

/** Scores only the supplied playable cards. It never previews hidden attacks or consumes RNG. */
export function scoreCombatCards(
  cards: readonly BattleCard[],
  state: BattleSnapshot,
  policy: CareerConfig["combatPolicy"],
  defenseOnlyTurns?: number,
): number[] {
  const modern = defenseOnlyTurns !== undefined;
  const scores = cards.map((card) => {
    if (modern && policy !== "random-playable" && shouldPreserveConsumable(card, state)) return -1;
    switch (policy) {
      case "random-playable":
        return 1;
      case "greedy-damage":
        return getImmediateDamage(card);
      case "defensive-random":
        return state.playerHealth < state.playerMaxHealth / 2 &&
          getImmediateDefense(card, modern ? state : undefined) > 0
          ? 2
          : 1;
      case "greedy-effective-damage":
        return getEffectiveDamageScore(card, state);
    }
  });
  if (!modern || policy === "random-playable") return scores;
  const bestAttack = Math.max(0, ...cards.map((card, index) => (isAttackCard(card) ? scores[index]! : 0)));
  if (bestAttack <= 0) return scores;
  return scores.map((score, index) => {
    const card = cards[index]!;
    if (isAttackCard(card) || getImmediateDefense(card, state) <= 0) return score;
    const spendsAllMana =
      state.mana > 0 &&
      (convertsManaToDefense(card.effects) || computeCardPayment(state, card).effectiveCost >= state.mana);
    // Emergency defense keeps its original priority for two defensive turns.
    // Afterwards an available attack must receive a turn, even if the pure
    // defense's nominal grant keeps growing with the Mana pool.
    return spendsAllMana && (state.playerHealth >= state.playerMaxHealth / 2 || defenseOnlyTurns >= 2)
      ? Math.min(score, bestAttack / 2)
      : score;
  });
}

/** Actor-local history advances only after committed commands, never on observation. */
export function createCombatProgress() {
  let defenseOnlyTurns = 0;
  let attacked = false;
  let enemyHealthAtTurnStart: number | undefined;
  return {
    defenseOnlyTurns: () => defenseOnlyTurns,
    committed(before: BattleSnapshot, after: BattleSnapshot, choice: PlayerChoice) {
      if (choice.kind === "play" || choice.kind === "wish") {
        enemyHealthAtTurnStart ??= before.enemyHealth;
        const card = choice.kind === "play" ? before.hand[choice.index ?? -1] : undefined;
        attacked ||= card !== undefined && isAttackCard(card);
      } else if (choice.kind === "end-turn") {
        const progressed = attacked || after.enemyHealth < (enemyHealthAtTurnStart ?? before.enemyHealth);
        defenseOnlyTurns = progressed ? 0 : defenseOnlyTurns + 1;
        attacked = false;
        enemyHealthAtTurnStart = undefined;
      } else {
        defenseOnlyTurns = 0;
        attacked = false;
        enemyHealthAtTurnStart = undefined;
      }
    },
  };
}
