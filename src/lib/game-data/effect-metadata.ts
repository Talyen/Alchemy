import { capitalizeWord } from "@/lib/utils";
import { effectChildren } from "./effect-tree";
import { createEffectDescription, createEffectLine } from "./effect-description";
import { renderCardDescription, type CardDescription } from "./card-description-model";
import { DAMAGE_TYPES } from "./types";
import type { BattleCard, BattleCardEffect, EnemyStatusId, KeywordId } from "./types";

interface EffectPresentation<K extends BattleCardEffect["kind"]> {
  keywords: (effect: Extract<BattleCardEffect, { kind: K }>) => KeywordId[];
}

const ENEMY_STATUS_KEYWORDS: ReadonlySet<EnemyStatusId> = new Set(["burn", "poison", "bleed", "freeze", "stun"]);

function isKeywordEnemyStatus(status: EnemyStatusId): status is Extract<EnemyStatusId, KeywordId> {
  return ENEMY_STATUS_KEYWORDS.has(status);
}

const PRESENTATION: { [K in BattleCardEffect["kind"]]: EffectPresentation<K> } = {
  damage: {
    keywords: (effect) =>
      dedupeKeywords(
        effect.damageTypePool?.length ? effect.damageTypePool : [effect.damageType],
        effect.lifesteal ? ["leech"] : [],
        effect.damageTypeIfTargetHasBlock ? [effect.damageTypeIfTargetHasBlock] : [],
        effect.damageTypeIfTargetFrozen ? [effect.damageTypeIfTargetFrozen] : [],
        effect.blockCost !== undefined ? ["block"] : [],
      ),
  },
  "cleanse-player-status-to-damage": { keywords: (effect) => [effect.status, effect.damageType] },
  "random-damage": {
    keywords: (effect) => [...(effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES)],
  },
  chance: { keywords: (effect) => [...new Set(effectChildren(effect).flatMap(collectKeywordsFromBattleEffect))] },
  "player-status": {
    keywords: (effect) =>
      effect.statusPool
        ? [...effect.statusPool]
        : effect.status !== "haste" && effect.status !== "phoenixFeather"
          ? [effect.status]
          : [],
  },
  "enemy-status": {
    keywords: (effect) => (isKeywordEnemyStatus(effect.status) ? [effect.status] : []),
  },
  heal: { keywords: () => ["health"] },
  "restore-mana": {
    keywords: () => ["mana"],
  },
  "lose-mana": { keywords: () => ["mana"] },
  "lose-max-mana": { keywords: () => ["mana"] },
  "gain-max-mana": { keywords: () => ["mana"] },
  "gain-gold": {
    keywords: () => ["gold"],
  },
  wish: {
    keywords: (effect) => (effect.companionIfAbsent ? [] : ["wish"]),
  },
  "summon-companion": { keywords: () => ["companion"] },
  "buff-companion": { keywords: () => ["companion"] },
  "companion-action": {
    keywords: () => ["companion"],
  },
  "random-draw": { keywords: () => [] },
  "remove-harmful-status": {
    keywords: () => [],
  },
  "lose-health": { keywords: () => ["health"] },
  "draw-cards": {
    keywords: () => [],
  },
  "remove-enemy-armor": {
    keywords: () => ["armor"],
  },
  "multiply-enemy-status": {
    keywords: (effect) => [effect.status],
  },
  "remove-player-status": {
    keywords: (effect) => [effect.status],
  },
  "self-damage": {
    keywords: (effect) => [effect.damageType],
  },
  "repeat-over-turns": { keywords: (effect) => effect.effects.flatMap(collectKeywordsFromBattleEffect) },
  "next-hit-crit": { keywords: () => [] },
  "next-hit-leech": { keywords: () => ["leech"] },
  "play-next-card-twice": { keywords: () => [] },
  "next-hit-poison": { keywords: () => [] },
  "next-archery-free": { keywords: () => ["archery"] },
  "dodge-next-attack": { keywords: () => ["dodge"] },
};

export { createEffectDescription } from "./effect-description";

export function effectDescriptionLine(effect: BattleCardEffect): string {
  return renderCardDescription([effect], [{ parts: createEffectLine(effect, { effectIndex: 0 }), role: "effect" }])
    .descriptionLines[0]!;
}

export function describeCardEffects(effects: readonly BattleCardEffect[]): string[] {
  return renderCardDescription(effects, createEffectDescription(effects)).descriptionLines;
}

export function getCardDescription(card: BattleCard): CardDescription {
  if (card.description) return card.description;
  const description = createEffectDescription(card.effects);
  if (card.tags)
    description.push(...card.tags.map((tag) => ({ parts: [capitalizeWord(tag)], role: "keyword" as const })));
  if (card.consume && !card.effects.some((effect) => effect.kind === "summon-companion"))
    description.push({ parts: ["Consume"], role: "consume" });
  return description;
}

function dedupeKeywords(...iterables: readonly KeywordId[][]): KeywordId[] {
  return [...new Set(iterables.flat())];
}

export function collectKeywordsFromBattleEffect(effect: BattleCardEffect): KeywordId[] {
  return PRESENTATION[effect.kind].keywords(effect as never);
}

/** Exact canonical text needs no second number parser. Custom and saved wording still uses parity rules. */
export function canonicalCardDescriptionMatches(card: BattleCard): boolean {
  if (!card.effects.length) return false;
  let expected: string[];
  try {
    expected = describeCardEffects(card.effects);
  } catch {
    return false;
  }
  if (card.tags) expected.push(...card.tags.map(capitalizeWord));
  if (card.consume) expected.push("Consume");
  return (
    expected.length === card.descriptionLines.length &&
    expected.every((line, index) => line === card.descriptionLines[index])
  );
}
