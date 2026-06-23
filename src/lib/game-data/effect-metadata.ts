// Shared card-effect metadata: keyword extraction used by talents, rewards, and descriptions.
import type { BattleCardEffect, KeywordId } from "./types";

type KeywordCollector = (effect: BattleCardEffect) => KeywordId[];

const KEYWORD_COLLECTORS: Partial<Record<BattleCardEffect["kind"], KeywordCollector>> = {
  damage: (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "damage" }>;
    return e.lifesteal ? [e.damageType, "leech"] : [e.damageType];
  },
  "cleanse-player-status-to-damage": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "cleanse-player-status-to-damage" }>;
    return ["health", e.damageType];
  },
  "random-damage": () => [],
  chance: (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "chance" }>;
    const seen = new Set<KeywordId>();
    const keywords: KeywordId[] = [];
    for (const nested of [...e.successEffects, ...e.failureEffects]) {
      for (const kw of collectKeywordsFromBattleEffect(nested)) {
        if (!seen.has(kw)) {
          seen.add(kw);
          keywords.push(kw);
        }
      }
    }
    return keywords;
  },
  "player-status": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "player-status" }>;
    return e.status !== "haste" ? [e.status] : [];
  },
  "enemy-status": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "enemy-status" }>;
    return [e.status];
  },
  heal: () => ["health"],
  "restore-mana": () => ["mana"],
  "lose-mana": () => ["mana"],
  "lose-max-mana": () => ["mana"],
  "gain-max-mana": () => ["mana"],
  "gain-gold": () => ["gold"],
  wish: () => ["wish"],
  "summon-companion": () => ["companion"],
  "buff-companion": () => ["companion"],
  "remove-harmful-status": () => [],
  "lose-health": () => ["health"],
  "draw-cards": () => [],
  "remove-enemy-armor": () => ["armor"],
  "multiply-enemy-status": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "multiply-enemy-status" }>;
    return [e.status];
  },
  "remove-player-status": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "remove-player-status" }>;
    return [e.status];
  },
  "self-damage": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "self-damage" }>;
    return [e.damageType];
  },
};

/** Keywords implied by a single card effect (does not include card tags or consume). */
export function collectKeywordsFromBattleEffect(effect: BattleCardEffect): KeywordId[] {
  const collector = KEYWORD_COLLECTORS[effect.kind];
  return collector ? collector(effect) : [];
}
