import { getCardKeywords, type BattleCard, type BattleCardEffect } from "@/lib/game-data";

function effectsHaveDamage(effects: readonly BattleCardEffect[], damageType?: string): boolean {
  return effects.some((effect) => {
    if (effect.kind === "damage" && effect.damageTypePool?.length) {
      return damageType === undefined || effect.damageTypePool.some((type) => type === damageType);
    }
    if (effect.kind === "damage" || effect.kind === "cleanse-player-status-to-damage") {
      return damageType === undefined || effect.damageType === damageType;
    }
    if (effect.kind === "random-damage") return damageType === undefined || damageType === "physical";
    if (effect.kind === "chance") {
      return (
        effectsHaveDamage(effect.successEffects, damageType) || effectsHaveDamage(effect.failureEffects, damageType)
      );
    }
    if (effect.kind === "repeat-over-turns") return effectsHaveDamage(effect.effects, damageType);
    return false;
  });
}

export function hasDamageEffect(effects: readonly BattleCardEffect[]): boolean {
  return effectsHaveDamage(effects);
}

export function isAttackCard(card: Pick<BattleCard, "effects">): boolean {
  return hasDamageEffect(card.effects);
}

export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return effectsHaveDamage(card.effects, damageType);
}

export function cardHasKeyword(card: BattleCard, keyword: string): boolean {
  return getCardKeywords(card).some((candidate) => candidate === keyword);
}

export function isNatureCard(card: BattleCard): boolean {
  return cardHasKeyword(card, "nature");
}
