/**
 * Maps each registered effect kind to its battle apply handler (paired with game-data/effects/<kind>/definition.ts).
 */
import type { BattleCardEffectKind } from "@/lib/game-data";
import { applyCleansePlayerStatusToDamageEffect } from "./cleanse-player-status-to-damage/apply";
import { applyDamageEffect } from "./damage/apply";
import { applyDrawCardsEffect } from "./draw-cards/apply";
import { applyEnemyStatusEffect } from "./enemy-status/apply";
import { applyBuffCompanionEffect } from "./buff-companion/apply";
import { applyGainGoldEffect } from "./gain-gold/apply";
import { applyGainMaxManaEffect } from "./gain-max-mana/apply";
import { applyHealEffect } from "./heal/apply";
import { applyLoseHealthEffect } from "./lose-health/apply";
import { applyLoseManaEffect } from "./lose-mana/apply";
import { applyLoseMaxManaEffect } from "./lose-max-mana/apply";
import { applyMultiplyEnemyStatusEffect } from "./multiply-enemy-status/apply";
import { applyPlayerStatusEffectHandler } from "./player-status/apply";
import { applyRandomDamageEffect } from "./random-damage/apply";
import { applyRemoveEnemyArmorEffect } from "./remove-enemy-armor/apply";
import { applyRemoveHarmfulStatusEffect } from "./remove-harmful-status/apply";
import { applyRemovePlayerStatusEffect } from "./remove-player-status/apply";
import { applyRestoreManaEffect } from "./restore-mana/apply";
import { applySelfDamageEffect } from "./self-damage/apply";
import { applySummonCompanionEffect } from "./summon-companion/apply";
import type { EffectHandler } from "./handler-types";
import { applyWishEffectHandler } from "./wish/apply";

type RegisteredEffectKind = Exclude<BattleCardEffectKind, "chance">;

export const EFFECT_APPLY_BY_KIND: Record<RegisteredEffectKind, EffectHandler> = {
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
};

export function hasEffectApplyHandler(kind: BattleCardEffectKind): kind is RegisteredEffectKind {
  return kind !== "chance" && kind in EFFECT_APPLY_BY_KIND;
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
