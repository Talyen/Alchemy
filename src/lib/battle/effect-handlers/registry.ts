/**
 * Maps each registered effect kind to its battle apply handler.
 */
import type { BattleCardEffectKind } from "@/lib/game-data";
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
import { applySummonCompanionEffect, applyBuffCompanionEffect } from "./companion-handlers";
import {
  applyGainGoldEffect,
  applyWishEffectHandler,
  applyDrawCardsEffect,
  applyNextHitCritEffect,
  applyPlayNextCardTwiceEffect,
} from "./utility-handlers";
import type { EffectHandler } from "./handler-types";

type RegisteredEffectKind = Exclude<BattleCardEffectKind, "chance" | "repeat-over-turns">;

// `satisfies Record<...>` ensures ALL registered kinds have a handler at build time.
// The effect-handlers-registry.test.ts provides a runtime belt-and-suspenders check.
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
} satisfies Record<RegisteredEffectKind, EffectHandler>;

export function hasEffectApplyHandler(kind: BattleCardEffectKind): kind is RegisteredEffectKind {
  return kind !== "chance" && kind !== "repeat-over-turns" && kind in EFFECT_APPLY_BY_KIND;
}

export function applyEffectByKind(
  kind: BattleCardEffectKind,
  ...args: Parameters<EffectHandler>
): ReturnType<EffectHandler> {
  if (!hasEffectApplyHandler(kind)) {
    return args[0];
  }
  return EFFECT_APPLY_BY_KIND[kind](...args);
}
