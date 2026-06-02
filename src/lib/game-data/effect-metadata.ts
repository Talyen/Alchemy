// Shared card-effect metadata: keyword extraction used by talents, rewards, and descriptions.
import type { BattleCardEffect, KeywordId } from "./types";

/** Keywords implied by a single card effect (does not include card tags or consume). */
export function collectKeywordsFromBattleEffect(effect: BattleCardEffect): KeywordId[] {
  const keywords: KeywordId[] = [];

  switch (effect.kind) {
    case "damage":
      keywords.push(effect.damageType);
      if (effect.lifesteal) keywords.push("leech");
      break;
    case "cleanse-player-status-to-damage":
      keywords.push("health", effect.damageType);
      break;
    case "random-damage":
      break;
    case "player-status":
      if (effect.status !== "haste") keywords.push(effect.status as KeywordId);
      break;
    case "heal":
      keywords.push("health");
      break;
    case "restore-mana":
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
      keywords.push("mana");
      break;
    case "gain-gold":
      keywords.push("gold");
      break;
    case "wish":
      keywords.push("wish");
      break;
    case "summon-companion":
    case "buff-companion":
      keywords.push("companion");
      break;
    case "remove-harmful-status":
      break;
    case "lose-health":
      keywords.push("health");
      break;
    case "draw-cards":
      break;
    case "remove-enemy-armor":
      keywords.push("armor");
      break;
    case "multiply-enemy-status":
      keywords.push(effect.status as KeywordId);
      break;
    case "remove-player-status":
      keywords.push(effect.status as KeywordId);
      break;
    case "self-damage":
      keywords.push(effect.damageType as KeywordId);
      break;
    default: {
      const _exhaustive: never = effect;
      void _exhaustive;
      break;
    }
  }

  return keywords;
}
