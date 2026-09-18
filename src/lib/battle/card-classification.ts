import { getCardKeywords, type BattleCard, type BattleCardEffect, type KeywordId } from "@/lib/game-data";

// Single owner for walking nested effects. The recursive wrappers are
// "chance" (success/failure branches) and "repeat-over-turns" (scheduled
// effects); every battle-side walker must descend into both so new wrappers
// cannot silently fall out of targeting, classification, or replays.
function forEachNestedEffect(effects: readonly BattleCardEffect[], visit: (effect: BattleCardEffect) => void): void {
  for (const effect of effects) {
    visit(effect);
    if (effect.kind === "chance") {
      forEachNestedEffect(effect.successEffects, visit);
      forEachNestedEffect(effect.failureEffects, visit);
    } else if (effect.kind === "repeat-over-turns") {
      forEachNestedEffect(effect.effects, visit);
    }
  }
}

function collectDamageTypes(effects: readonly BattleCardEffect[], set: Set<string>): void {
  forEachNestedEffect(effects, (effect) => {
    if (effect.kind === "damage" && effect.damageTypePool?.length) {
      for (const type of effect.damageTypePool) set.add(type);
    } else if (effect.kind === "damage" || effect.kind === "cleanse-player-status-to-damage") {
      set.add(effect.damageType);
    } else if (effect.kind === "random-damage") {
      set.add("physical");
    }
  });
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
  let found = false;
  forEachNestedEffect(effects, (effect) => {
    if (
      effect.kind === "damage" ||
      effect.kind === "cleanse-player-status-to-damage" ||
      effect.kind === "random-damage"
    ) {
      found = true;
    }
  });
  return found;
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
      return "player";
    case "chance":
    case "repeat-over-turns":
      return null;
  }
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" {
  let target: "player" | "enemy" | null = null;
  // Depth-first, in card order — the same sequence the previous recursive
  // walk visited — so the first concrete target still wins.
  forEachNestedEffect(card.effects, (effect) => {
    target ??= effectTarget(effect);
  });
  return target ?? "enemy";
}
