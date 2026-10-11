import { capitalizeWord } from "@/lib/utils";
import { effectChildren } from "./effect-tree";
import { createEffectDescription } from "./effect-description";
import { renderCardDescription, type CardDescription } from "./card-description-model";
import { DAMAGE_TYPES } from "./types";
import type { BattleCard, BattleCardEffect, EnemyStatusId, KeywordId } from "./types";

type EffectPresentation<K extends BattleCardEffect["kind"]> = (
  effect: Extract<BattleCardEffect, { kind: K }>,
) => KeywordId[];

const ENEMY_STATUS_KEYWORDS: ReadonlySet<EnemyStatusId> = new Set(["burn", "poison", "bleed", "freeze", "stun"]);

function isKeywordEnemyStatus(status: EnemyStatusId): status is Extract<EnemyStatusId, KeywordId> {
  return ENEMY_STATUS_KEYWORDS.has(status);
}

const PRESENTATION: { [K in BattleCardEffect["kind"]]: EffectPresentation<K> } = {
  damage: (effect) =>
    dedupeKeywords(
      effect.damageTypePool?.length ? effect.damageTypePool : [effect.damageType],
      effect.lifesteal ? ["leech"] : [],
      effect.damageTypeIfTargetHasBlock ? [effect.damageTypeIfTargetHasBlock] : [],
      effect.damageTypeIfTargetFrozen ? [effect.damageTypeIfTargetFrozen] : [],
      effect.blockCost !== undefined || effect.equalToBlock ? ["block"] : [],
      effect.equalToArmor ? ["armor"] : [],
      effect.equalToForge || effect.forgeBonusPercent !== undefined ? ["forge"] : [],
      effect.equalToGoldPercent !== undefined ? ["gold"] : [],
    ),
  "cleanse-player-status-to-damage": (effect) => [effect.status, effect.damageType],
  "random-damage": (effect) => [...(effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES)],
  chance: (effect) => [...new Set(effectChildren(effect).flatMap(collectKeywordsFromBattleEffect))],
  "player-status": (effect) =>
    dedupeKeywords(
      effect.statusPool
        ? [...effect.statusPool]
        : effect.status !== "haste" && effect.status !== "phoenixFeather"
          ? [effect.status]
          : [],
      effect.perManaCrystal !== undefined || effect.convertCurrentMana !== undefined ? ["mana"] : [],
    ),
  "enemy-status": (effect) => (isKeywordEnemyStatus(effect.status) ? [effect.status] : []),
  heal: () => ["health"],
  "restore-mana": () => ["mana"],
  "lose-mana": () => ["mana"],
  "lose-max-mana": () => ["mana"],
  "gain-max-mana": () => ["mana"],
  "gain-gold": () => ["gold"],
  wish: (effect) => (effect.companionIfAbsent ? [] : ["wish"]),
  "summon-companion": () => ["companion"],
  "buff-companion": () => ["companion"],
  "companion-action": () => ["companion"],
  "random-draw": () => [],
  "remove-harmful-status": () => [],
  "lose-health": () => ["health"],
  "draw-cards": () => [],
  "remove-enemy-armor": () => ["armor"],
  "multiply-enemy-status": (effect) => [effect.status],
  "remove-player-status": (effect) => [effect.status],
  "self-damage": (effect) => [effect.damageType],
  "repeat-over-turns": (effect) => effect.effects.flatMap(collectKeywordsFromBattleEffect),
  "next-hit-crit": () => [],
  "next-hit-leech": () => ["leech"],
  "play-next-card-twice": () => [],
  "next-hit-poison": () => [],
  "next-archery-free": () => ["archery"],
  "dodge-next-attack": () => ["dodge"],
};

export { createEffectDescription } from "./effect-description";

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
  return PRESENTATION[effect.kind](effect as never);
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
