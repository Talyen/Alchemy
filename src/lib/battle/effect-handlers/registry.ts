import type { BattleCard, BattleCardEffect, BattleCardEffectKind } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";
import type { CardEffectResolutionContext, EffectHandler } from "./handler-types";
import {
  applyDamageEffect,
  applySelfDamageEffect,
  applyRandomDamageEffect,
  applyRemoveEnemyArmorEffect,
} from "./damage-handlers";
import {
  applyPlayerStatusEffectHandler,
  applyEnemyStatusEffect,
  applyRemoveHarmfulStatusEffect,
  applyRemovePlayerStatusEffect,
  applyMultiplyEnemyStatusEffect,
  applyCleansePlayerStatusToDamageEffect,
} from "./status-handlers";
import {
  applyRestoreManaEffect,
  applyLoseManaEffect,
  applyGainMaxManaEffect,
  applyLoseMaxManaEffect,
  applyHealEffect,
  applyLoseHealthEffect,
} from "./mana-health-handlers";
import {
  applySummonCompanionEffect,
  applyBuffCompanionEffect,
  applyGainGoldEffect,
  applyWishEffectHandler,
  applyDrawCardsEffect,
  applyNextHitCritEffect,
  applyPlayNextCardTwiceEffect,
  applyNextHitPoisonEffect,
} from "./simple-handlers";

type RegisteredEffectKind = Exclude<BattleCardEffectKind, "chance" | "repeat-over-turns">;

export const EFFECT_APPLY_BY_KIND = {
  damage: applyDamageEffect,
  "player-status": applyPlayerStatusEffectHandler,
  "enemy-status": applyEnemyStatusEffect,
  heal: applyHealEffect,
  "restore-mana": applyRestoreManaEffect,
  "lose-mana": applyLoseManaEffect,
  "lose-max-mana": applyLoseMaxManaEffect,
  "gain-max-mana": applyGainMaxManaEffect,
  "gain-gold": applyGainGoldEffect,
  wish: applyWishEffectHandler,
  "summon-companion": applySummonCompanionEffect,
  "remove-harmful-status": applyRemoveHarmfulStatusEffect,
  "remove-player-status": applyRemovePlayerStatusEffect,
  "self-damage": applySelfDamageEffect,
  "buff-companion": applyBuffCompanionEffect,
  "lose-health": applyLoseHealthEffect,
  "draw-cards": applyDrawCardsEffect,
  "remove-enemy-armor": applyRemoveEnemyArmorEffect,
  "multiply-enemy-status": applyMultiplyEnemyStatusEffect,
  "cleanse-player-status-to-damage": applyCleansePlayerStatusToDamageEffect,
  "random-damage": applyRandomDamageEffect,
  "next-hit-crit": applyNextHitCritEffect,
  "play-next-card-twice": applyPlayNextCardTwiceEffect,
  "next-hit-poison": applyNextHitPoisonEffect,
} satisfies Record<RegisteredEffectKind, EffectHandler>;

function hasEffectApplyHandler(kind: BattleCardEffectKind): kind is RegisteredEffectKind {
  return kind !== "chance" && kind !== "repeat-over-turns" && kind in EFFECT_APPLY_BY_KIND;
}

export function applyEffectByKind(
  kind: BattleCardEffectKind,
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
): BattleState {
  if (!hasEffectApplyHandler(kind)) {
    console.warn(`[Battle] Missing handler for effect kind: ${kind}`);
    return state;
  }
  return EFFECT_APPLY_BY_KIND[kind](state, card, effect, potionMult, combatTexts, context);
}
