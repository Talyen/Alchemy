import {
  cardHasKeyword,
  DAMAGE_TYPES,
  visitBattleCardEffects,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { isDeeplyFrozenData } from "@/lib/immutable-data";

export { cardHasKeyword };

interface EffectClassification {
  damageTypes: ReadonlySet<string>;
  playTarget: "player" | "enemy";
}

// Frozen effect trees can share classification; editable copies must be rechecked.
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
      if (effect.damageTypeIfTargetFrozen) damageTypes.add(effect.damageTypeIfTargetFrozen);
      if (effect.damageTypePool?.length) {
        for (const type of effect.damageTypePool) damageTypes.add(type);
      } else damageTypes.add(effect.damageType);
    } else if (effect.kind === "cleanse-player-status-to-damage") {
      damageTypes.add(effect.damageType);
    } else if (effect.kind === "random-damage") {
      for (const type of effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES) damageTypes.add(type);
    }
  });
  const classification: EffectClassification = {
    damageTypes,
    playTarget: playTarget ?? "enemy",
  };
  if (isDeeplyFrozenData(effects)) EFFECT_CLASSIFICATION_CACHE.set(effects, classification);
  return classification;
}

export function hasDamageEffect(effects: readonly BattleCardEffect[]): boolean {
  const cached = EFFECT_CLASSIFICATION_CACHE.get(effects);
  if (cached) return cached.damageTypes.size > 0;
  if (Object.isFrozen(effects)) return classifyEffects(effects).damageTypes.size > 0;
  return visitBattleCardEffects(
    effects,
    (effect) =>
      effect.kind === "damage" || effect.kind === "random-damage" || effect.kind === "cleanse-player-status-to-damage",
  );
}

export function isAttackCard(card: Pick<BattleCard, "effects">): boolean {
  return hasDamageEffect(card.effects);
}

export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  const effects = card.effects;
  const cached = EFFECT_CLASSIFICATION_CACHE.get(effects);
  if (cached) return cached.damageTypes.has(damageType);
  if (Object.isFrozen(effects)) return classifyEffects(effects).damageTypes.has(damageType);
  return visitBattleCardEffects(effects, (effect) => {
    if (effect.kind === "damage") {
      return (
        effect.damageTypeIfTargetFrozen === damageType ||
        (effect.damageTypePool?.length
          ? effect.damageTypePool.includes(damageType as typeof effect.damageType)
          : effect.damageType === damageType)
      );
    }
    if (effect.kind === "cleanse-player-status-to-damage") return effect.damageType === damageType;
    if (effect.kind === "random-damage") {
      const pool: readonly string[] = effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES;
      return pool.includes(damageType);
    }
    return false;
  });
}

export function isNatureCard(card: BattleCard): boolean {
  return cardHasKeyword(card, "nature");
}

export function damageOnlyEffects(effects: readonly BattleCardEffect[]): BattleCardEffect[] {
  const damage: BattleCardEffect[] = [];
  for (const effect of effects) {
    if (
      effect.kind === "damage" ||
      effect.kind === "random-damage" ||
      effect.kind === "cleanse-player-status-to-damage"
    )
      damage.push(effect);
    else if (effect.kind === "chance") {
      const successEffects = damageOnlyEffects(effect.successEffects);
      const failureEffects = damageOnlyEffects(effect.failureEffects);
      if (successEffects.length || failureEffects.length) damage.push({ ...effect, successEffects, failureEffects });
    } else if (effect.kind === "repeat-over-turns") {
      const inner = damageOnlyEffects(effect.effects);
      if (inner.length) damage.push({ ...effect, effects: inner });
    }
  }
  return damage;
}

export function effectTarget(effect: BattleCardEffect): "player" | "enemy" | null {
  switch (effect.kind) {
    case "damage":
    case "random-damage":
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
  const effects = card.effects;
  const cached = EFFECT_CLASSIFICATION_CACHE.get(effects);
  if (cached) return cached.playTarget;
  if (Object.isFrozen(effects)) return classifyEffects(effects).playTarget;
  let target: "player" | "enemy" | null = null;
  visitBattleCardEffects(effects, (effect) => {
    target = effectTarget(effect);
    return target !== null;
  });
  return target ?? "enemy";
}
