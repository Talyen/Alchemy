// Shared card-effect metadata: keyword extraction used by talents, rewards, and descriptions.
import type { BattleCardEffect, KeywordId } from "./types";

type KeywordFormatter<K extends BattleCardEffect["kind"]> = (
  effect: Extract<BattleCardEffect, { kind: K }>,
) => KeywordId[];

const FORMATTERS: { [K in BattleCardEffect["kind"]]: KeywordFormatter<K> } = {
  damage: (effect) => (effect.lifesteal ? [effect.damageType, "leech"] : [effect.damageType]),
  "cleanse-player-status-to-damage": (effect) => ["health", effect.damageType],
  "random-damage": () => [],
  chance: (effect) => collectKeywordsFromChance(effect),
  "player-status": (effect) => (effect.status !== "haste" ? [effect.status] : []),
  "enemy-status": (effect) => [effect.status],
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
  "multiply-enemy-status": (effect) => [effect.status],
  "remove-player-status": (effect) => [effect.status],
  "self-damage": (effect) => [effect.damageType],
};

function dedupeKeywords(...iterables: readonly KeywordId[][]): KeywordId[] {
  const seen = new Set<KeywordId>();
  const result: KeywordId[] = [];
  for (const arr of iterables) {
    for (const kw of arr) {
      if (!seen.has(kw)) {
        seen.add(kw);
        result.push(kw);
      }
    }
  }
  return result;
}

function collectKeywordsFromChance(effect: Extract<BattleCardEffect, { kind: "chance" }>): KeywordId[] {
  return dedupeKeywords(
    effect.successEffects.flatMap(collectKeywordsFromBattleEffect),
    effect.failureEffects.flatMap(collectKeywordsFromBattleEffect),
  );
}

/** Keywords implied by a single card effect (does not include card tags or consume). */
export function collectKeywordsFromBattleEffect(effect: BattleCardEffect): KeywordId[] {
  return FORMATTERS[effect.kind](effect as never);
}
