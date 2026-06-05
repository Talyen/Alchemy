/**
 * Routes card effects to battle handlers using game-data dispatch registry.
 */
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { getEffectDispatchRoute } from "@/lib/game-data";
import { handleManaEffect } from "./mana-route";
import { handleCleansePlayerStatusToDamage, handleRandomDamage } from "./special-route";
import { handleUtilityEffect } from "./utility-route";
import type { BattleState, CombatTextEvent } from "../types";
import { POTION_CARD_ID_SUFFIX } from "../../game-constants";
import { getBattleRng } from "../status-helpers";
import { handleDamageEffect } from "./damage-effect";
import { handleEnemyStatusEffect } from "./enemy-status-effect";
import { handleHealEffect } from "./heal-effect";
import { handlePlayerStatusEffect } from "./player-status-effect";

function applySingleEffect(
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const route = getEffectDispatchRoute(effect.kind);
  if (!route) return state;

  switch (route) {
    case "damage":
      return effect.kind === "damage" ? handleDamageEffect(state, card, effect, potionMult, combatTexts) : state;
    case "player-status":
      return effect.kind === "player-status" ? handlePlayerStatusEffect(state, effect, potionMult, combatTexts) : state;
    case "enemy-status":
      return effect.kind === "enemy-status" ? handleEnemyStatusEffect(state, effect, combatTexts) : state;
    case "heal":
      return effect.kind === "heal"
        ? handleHealEffect(state, effect, potionMult, card.consume ?? false, combatTexts)
        : state;
    case "cleanse-player-status-to-damage":
      return effect.kind === "cleanse-player-status-to-damage"
        ? handleCleansePlayerStatusToDamage(state, card, effect, combatTexts)
        : state;
    case "random-damage":
      return effect.kind === "random-damage" ? handleRandomDamage(state, card, effect, combatTexts) : state;
    case "chance": {
      if (effect.kind !== "chance") return state;
      const rng = getBattleRng(state);
      const branch = rng() < effect.probability ? effect.successEffects : effect.failureEffects;
      return branch.reduce((s, nested) => applyCardEffects(s, { ...card, effects: [nested] }, combatTexts), state);
    }
    case "mana":
      return effect.kind === "restore-mana" ||
        effect.kind === "lose-mana" ||
        effect.kind === "gain-max-mana" ||
        effect.kind === "lose-max-mana"
        ? handleManaEffect(state, effect, potionMult, combatTexts)
        : state;
    case "utility":
      return handleUtilityEffect(state, card, effect, potionMult, combatTexts);
  }
}

export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  const potionMult = card.id.endsWith(POTION_CARD_ID_SUFFIX) ? state.talentEffects.potionPotency : 1;
  return card.effects.reduce(
    (currentState, effect) => applySingleEffect(currentState, card, effect, potionMult, combatTexts),
    state,
  );
}
