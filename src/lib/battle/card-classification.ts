import { getCardKeywords, type BattleCard, type BattleCardEffect, type KeywordId } from "@/lib/game-data";

function collectDamageTypes(effects: readonly BattleCardEffect[], set: Set<string>): void {
  for (const effect of effects) {
    if (effect.kind === "damage" && effect.damageTypePool?.length) {
      for (const type of effect.damageTypePool) set.add(type);
    } else if (effect.kind === "damage" || effect.kind === "cleanse-player-status-to-damage") {
      set.add(effect.damageType);
    } else if (effect.kind === "random-damage") {
      set.add("physical");
    } else if (effect.kind === "chance") {
      collectDamageTypes(effect.successEffects, set);
      collectDamageTypes(effect.failureEffects, set);
    } else if (effect.kind === "repeat-over-turns") {
      collectDamageTypes(effect.effects, set);
    }
  }
}

const CARD_DAMAGE_TYPES_CACHE = new WeakMap<BattleCard, Set<string>>();

function getCardDamageTypes(card: BattleCard): Set<string> {
  const cached = CARD_DAMAGE_TYPES_CACHE.get(card);
  if (cached) return cached;
  const types = new Set<string>();
  collectDamageTypes(card.effects, types);
  CARD_DAMAGE_TYPES_CACHE.set(card, types);
  return types;
}

export function hasDamageEffect(effects: readonly BattleCardEffect[]): boolean {
  return effects.some((effect) => {
    if (
      effect.kind === "damage" ||
      effect.kind === "cleanse-player-status-to-damage" ||
      effect.kind === "random-damage"
    ) {
      return true;
    }
    if (effect.kind === "chance") {
      return hasDamageEffect(effect.successEffects) || hasDamageEffect(effect.failureEffects);
    }
    if (effect.kind === "repeat-over-turns") {
      return hasDamageEffect(effect.effects);
    }
    return false;
  });
}

const ATTACK_CARD_CACHE = new WeakMap<object, boolean>();

export function isAttackCard(card: Pick<BattleCard, "effects">): boolean {
  const cached = ATTACK_CARD_CACHE.get(card);
  if (cached !== undefined) return cached;
  const result = hasDamageEffect(card.effects);
  ATTACK_CARD_CACHE.set(card, result);
  return result;
}

export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return getCardDamageTypes(card).has(damageType);
}

export function cardHasKeyword(card: BattleCard, keyword: string): boolean {
  return getCardKeywords(card).includes(keyword as KeywordId);
}

export function isNatureCard(card: BattleCard): boolean {
  return cardHasKeyword(card, "nature");
}
