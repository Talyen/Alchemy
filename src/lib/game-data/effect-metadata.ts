// Shared card-effect metadata: keyword extraction used by talents, rewards, and descriptions.
import type { BattleCardEffect, KeywordId } from "./types";

/** Keywords implied by a single card effect (does not include card tags or consume). */
export function collectKeywordsFromBattleEffect(effect: BattleCardEffect): KeywordId[] {
  switch (effect.kind) {
    case "damage":
      return effect.lifesteal ? [effect.damageType, "leech"] : [effect.damageType];
    case "cleanse-player-status-to-damage":
      return ["health", effect.damageType];
    case "random-damage":
      return [];
    case "chance": {
      const seen = new Set<KeywordId>();
      const keywords: KeywordId[] = [];
      for (const nested of [...effect.successEffects, ...effect.failureEffects]) {
        for (const kw of collectKeywordsFromBattleEffect(nested)) {
          if (!seen.has(kw)) {
            seen.add(kw);
            keywords.push(kw);
          }
        }
      }
      return keywords;
    }
    case "player-status":
      return effect.status !== "haste" ? [effect.status] : [];
    case "enemy-status":
      return [effect.status];
    case "heal":
      return ["health"];
    case "restore-mana":
      return ["mana"];
    case "lose-mana":
      return ["mana"];
    case "lose-max-mana":
      return ["mana"];
    case "gain-max-mana":
      return ["mana"];
    case "gain-gold":
      return ["gold"];
    case "wish":
      return ["wish"];
    case "summon-companion":
      return ["companion"];
    case "buff-companion":
      return ["companion"];
    case "remove-harmful-status":
      return [];
    case "lose-health":
      return ["health"];
    case "draw-cards":
      return [];
    case "remove-enemy-armor":
      return ["armor"];
    case "multiply-enemy-status":
      return [effect.status];
    case "remove-player-status":
      return [effect.status];
    case "self-damage":
      return [effect.damageType];
  }
}
