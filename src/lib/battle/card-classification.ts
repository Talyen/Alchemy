import {
  getCardKeywords,
  DAMAGE_TYPES,
  visitBattleCardEffects,
  type BattleCard,
  type BattleCardEffect,
  type KeywordId,
} from "@/lib/game-data";

interface EffectClassification {
  damageTypes: ReadonlySet<string>;
  playTarget: "player" | "enemy";
}

// All derived classification belongs to the immutable effect tree. Card
// variants share it; replacing effects automatically selects a fresh entry.
const EFFECT_CLASSIFICATION_CACHE = new WeakMap<readonly BattleCardEffect[], EffectClassification>();

function classifyEffects(effects: readonly BattleCardEffect[]): EffectClassification {
  const cached = EFFECT_CLASSIFICATION_CACHE.get(effects);
  if (cached) return cached;
  const damageTypes = new Set<string>();
  let playTarget: "player" | "enemy" | null = null;
  visitBattleCardEffects(effects, (effect) => {
    // Targeting uses the first concrete effect; damage queries include the
    // whole tree, even when later effects target the other side.
    playTarget ??= effectTarget(effect);
    if (effect.kind === "damage") {
      if (effect.damageTypeIfTargetHasBlock) damageTypes.add(effect.damageTypeIfTargetHasBlock);
      if (effect.damageTypeIfTargetFrozen) damageTypes.add(effect.damageTypeIfTargetFrozen);
      for (const type of effect.damageTypePool?.length ? effect.damageTypePool : [effect.damageType]) {
        damageTypes.add(type);
      }
    } else if (effect.kind === "cleanse-player-status-to-damage") {
      damageTypes.add(effect.damageType);
    } else if (effect.kind === "random-damage") {
      for (const type of effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES) damageTypes.add(type);
    }
  });
  const classification: EffectClassification = { damageTypes, playTarget: playTarget ?? "enemy" };
  EFFECT_CLASSIFICATION_CACHE.set(effects, classification);
  return classification;
}

export function hasDamageEffect(effects: readonly BattleCardEffect[]): boolean {
  return classifyEffects(effects).damageTypes.size > 0;
}

export function isAttackCard(card: Pick<BattleCard, "effects">): boolean {
  return hasDamageEffect(card.effects);
}

export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return classifyEffects(card.effects).damageTypes.has(damageType);
}

export function cardHasKeyword(card: BattleCard, keyword: string): boolean {
  return getCardKeywords(card).includes(keyword as KeywordId);
}

export function isNatureCard(card: BattleCard): boolean {
  return cardHasKeyword(card, "nature");
}

export function damageOnlyEffects(effects: readonly BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((effect): BattleCardEffect[] => {
    if (effect.kind === "damage" || effect.kind === "random-damage") return [effect];
    if (effect.kind === "chance") {
      const successEffects = damageOnlyEffects(effect.successEffects);
      const failureEffects = damageOnlyEffects(effect.failureEffects);
      return successEffects.length || failureEffects.length ? [{ ...effect, successEffects, failureEffects }] : [];
    }
    if (effect.kind === "repeat-over-turns") {
      const inner = damageOnlyEffects(effect.effects);
      return inner.length ? [{ ...effect, effects: inner }] : [];
    }
    return [];
  });
}

function effectTarget(effect: BattleCardEffect): "player" | "enemy" | null {
  switch (effect.kind) {
    case "damage":
    case "random-damage":
    case "enemy-status":
    case "remove-enemy-armor":
    case "multiply-enemy-status":
    case "cleanse-player-status-to-damage":
      return "enemy";
    case "player-status":
    case "heal":
    case "restore-mana":
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
    case "gain-gold":
    case "wish":
    case "summon-companion":
    case "buff-companion":
    case "companion-action":
    case "random-draw":
    case "lose-health":
    case "draw-cards":
    case "remove-harmful-status":
    case "remove-player-status":
    case "self-damage":
    case "next-hit-crit":
    case "next-hit-leech":
    case "play-next-card-twice":
    case "next-hit-poison":
    case "next-archery-free":
    case "dodge-next-attack":
      return "player";
    case "chance":
    case "repeat-over-turns":
      return null;
  }
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" {
  return classifyEffects(card.effects).playTarget;
}

export function getBattleCardTransmutationRole(card: Pick<BattleCard, "effects">): "attack" | "defense" | "utility" {
  if (isAttackCard(card)) {
    return "attack";
  }

  let hasDefense = false;
  visitBattleCardEffects(card.effects, (effect) => {
    if (effect.kind === "heal") {
      hasDefense = true;
    } else if (
      effect.kind === "player-status" &&
      (effect.status === "block" || effect.status === "armor" || effect.status === "thorns")
    ) {
      hasDefense = true;
    }
  });

  return hasDefense ? "defense" : "utility";
}
