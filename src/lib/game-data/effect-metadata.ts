import { capitalizeWord } from "@/lib/utils";
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { visitBattleCardEffects } from "./effect-tree";
import { createEffectDescription } from "./effect-description";
import { renderCardDescription, type CardDescription } from "./card-description-model";
import { DAMAGE_TYPES } from "./types";
import type { BattleCard, BattleCardEffect, KeywordId } from "./types";

type LeafEffectKind = Exclude<BattleCardEffect["kind"], "chance" | "repeat-over-turns">;
type EffectPresentation<K extends LeafEffectKind> = (
  effect: Extract<BattleCardEffect, { kind: K }>,
) => readonly KeywordId[];

const EMPTY_KEYWORDS: readonly KeywordId[] = [];
const HEALTH_KEYWORDS: readonly KeywordId[] = ["health"];
const MANA_KEYWORDS: readonly KeywordId[] = ["mana"];
const GOLD_KEYWORDS: readonly KeywordId[] = ["gold"];
const WISH_KEYWORDS: readonly KeywordId[] = ["wish"];
const COMPANION_KEYWORDS: readonly KeywordId[] = ["companion"];
const ARMOR_KEYWORDS: readonly KeywordId[] = ["armor"];
const LEECH_KEYWORDS: readonly KeywordId[] = ["leech"];
const POISON_KEYWORDS: readonly KeywordId[] = ["poison"];
const ARCHERY_KEYWORDS: readonly KeywordId[] = ["archery"];
const DODGE_KEYWORDS: readonly KeywordId[] = ["dodge"];

const PRESENTATION: { [K in LeafEffectKind]: EffectPresentation<K> } = {
  damage: (effect) => {
    const keywords: KeywordId[] = effect.damageTypePool?.length ? [...effect.damageTypePool] : [effect.damageType];
    if (effect.lifesteal) keywords.push("leech");
    if (effect.damageTypeIfTargetFrozen) keywords.push(effect.damageTypeIfTargetFrozen);
    if (effect.equalToBlock) keywords.push("block");
    if (effect.equalToArmor) keywords.push("armor");
    if (effect.forgeBonusPercent !== undefined) keywords.push("forge");
    return keywords;
  },
  "cleanse-player-status-to-damage": (effect) => {
    const keywords: KeywordId[] = [effect.status, effect.damageType];
    if (effect.lifesteal) keywords.push("leech");
    return keywords;
  },
  "random-damage": (effect) => {
    const keywords: KeywordId[] = [...(effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES)];
    if (effect.lifesteal) keywords.push("leech");
    return keywords;
  },
  "player-status": (effect) => {
    const keywords: KeywordId[] = effect.statusPool
      ? [...effect.statusPool]
      : effect.status !== "haste" && effect.status !== "phoenixFeather"
        ? [effect.status]
        : [];
    if (effect.perManaCrystal !== undefined || effect.convertCurrentMana !== undefined) keywords.push("mana");
    return keywords;
  },
  heal: () => HEALTH_KEYWORDS,
  "restore-mana": () => MANA_KEYWORDS,
  "lose-mana": () => MANA_KEYWORDS,
  "lose-max-mana": () => MANA_KEYWORDS,
  "gain-max-mana": () => MANA_KEYWORDS,
  "gain-gold": () => GOLD_KEYWORDS,
  wish: (effect) => (effect.companionIfAbsent ? EMPTY_KEYWORDS : WISH_KEYWORDS),
  "summon-companion": () => COMPANION_KEYWORDS,
  "companion-action": () => COMPANION_KEYWORDS,
  "random-draw": () => EMPTY_KEYWORDS,
  "remove-harmful-status": () => EMPTY_KEYWORDS,
  "lose-health": () => HEALTH_KEYWORDS,
  "draw-cards": () => EMPTY_KEYWORDS,
  "remove-enemy-armor": () => ARMOR_KEYWORDS,
  "multiply-enemy-status": (effect) => [effect.status],
  "remove-player-status": (effect) => [effect.status],
  "self-damage": (effect) => [effect.damageType],
  "next-hit-crit": () => EMPTY_KEYWORDS,
  "next-hit-leech": () => LEECH_KEYWORDS,
  "play-next-card-twice": () => EMPTY_KEYWORDS,
  "next-hit-poison": () => POISON_KEYWORDS,
  "next-archery-free": () => ARCHERY_KEYWORDS,
  "dodge-next-attack": () => DODGE_KEYWORDS,
};

export { createEffectDescription } from "./effect-description";

export function describeCardEffects(effects: readonly BattleCardEffect[]): string[] {
  return renderCardDescription(effects, createEffectDescription(effects)).descriptionLines;
}

/** Build the shared keyword and Consume trailer in its authored order. */
export function appendCardDescriptionTrailer(
  description: CardDescription,
  tags: readonly string[] | undefined,
  consume: boolean,
): void {
  for (const tag of tags ?? []) description.push({ parts: [capitalizeWord(tag)], role: "keyword" });
  if (consume) description.push({ parts: [CONSUME_DESCRIPTION_LINE], role: "consume" });
}

export function getCardDescription(card: BattleCard): CardDescription {
  if (card.description) return card.description;
  const description = createEffectDescription(card.effects);
  appendCardDescriptionTrailer(
    description,
    card.tags,
    !!card.consume && !card.effects.some((effect) => effect.kind === "summon-companion"),
  );
  return description;
}

export function collectKeywordsFromBattleEffects(effects: readonly BattleCardEffect[]): KeywordId[] {
  const keywords = new Set<KeywordId>();
  visitBattleCardEffects(effects, (entry) => {
    if (entry.kind === "chance" || entry.kind === "repeat-over-turns") return;
    for (const keyword of PRESENTATION[entry.kind](entry as never)) keywords.add(keyword);
  });
  return [...keywords];
}
