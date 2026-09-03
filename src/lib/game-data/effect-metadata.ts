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
  "enemy-status": (effect) =>
    effect.status === "burn" ||
    effect.status === "poison" ||
    effect.status === "bleed" ||
    effect.status === "freeze" ||
    effect.status === "stun"
      ? [effect.status]
      : [],
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
  "repeat-over-turns": (effect) => effect.effects.flatMap(collectKeywordsFromBattleEffect),
  "next-hit-crit": () => [],
  "play-next-card-twice": () => [],
  "next-hit-poison": () => [],
  "next-archery-free": () => ["archery"],
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

export function collectKeywordsFromBattleEffect(effect: BattleCardEffect): KeywordId[] {
  return FORMATTERS[effect.kind](effect as never);
}
