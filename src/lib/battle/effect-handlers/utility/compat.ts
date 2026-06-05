/** @deprecated Prefer per-kind apply modules or applyEffectByKind from ./registry. */
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../../types";
import { applyBuffCompanionEffect } from "../buff-companion/apply";
import { applyDrawCardsEffect } from "../draw-cards/apply";
import { applyGainGoldEffect } from "../gain-gold/apply";
import { applyLoseHealthEffect } from "../lose-health/apply";
import { applyMultiplyEnemyStatusEffect } from "../multiply-enemy-status/apply";
import { applyRemoveEnemyArmorEffect } from "../remove-enemy-armor/apply";
import { applyRemoveHarmfulStatusEffect } from "../remove-harmful-status/apply";
import { applyRemovePlayerStatusEffect } from "../remove-player-status/apply";
import { applySelfDamageEffect } from "../self-damage/apply";
import { applySummonCompanionEffect } from "../summon-companion/apply";
import { applyWishEffectHandler } from "../wish/apply";

export function handleUtilityEffect(
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  switch (effect.kind) {
    case "gain-gold":
      return applyGainGoldEffect(state, card, effect, potionMult, combatTexts);
    case "wish":
      return applyWishEffectHandler(state, card, effect, potionMult, combatTexts);
    case "summon-companion":
      return applySummonCompanionEffect(state, card, effect, potionMult, combatTexts);
    case "buff-companion":
      return applyBuffCompanionEffect(state, card, effect, potionMult, combatTexts);
    case "remove-harmful-status":
      return applyRemoveHarmfulStatusEffect(state, card, effect, potionMult, combatTexts);
    case "self-damage":
      return applySelfDamageEffect(state, card, effect, potionMult, combatTexts);
    case "lose-health":
      return applyLoseHealthEffect(state, card, effect, potionMult, combatTexts);
    case "draw-cards":
      return applyDrawCardsEffect(state, card, effect, potionMult, combatTexts);
    case "remove-enemy-armor":
      return applyRemoveEnemyArmorEffect(state, card, effect, potionMult, combatTexts);
    case "multiply-enemy-status":
      return applyMultiplyEnemyStatusEffect(state, card, effect, potionMult, combatTexts);
    case "remove-player-status":
      return applyRemovePlayerStatusEffect(state, card, effect, potionMult, combatTexts);
    default:
      return state;
  }
}
