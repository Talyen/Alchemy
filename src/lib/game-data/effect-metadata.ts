import { capitalizeWord } from "@/lib/utils";
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { visitBattleCardEffects } from "./effect-tree";
import { createEffectDescription } from "./effect-description";
import { renderCardDescription, type CardDescription } from "./card-description-model";
import { DAMAGE_TYPES } from "./types";
import type { BattleCard, BattleCardEffect, KeywordId } from "./types";

type LeafEffectKind = Exclude<BattleCardEffect["kind"], "chance" | "repeat-over-turns">;
type EffectPresentation<K extends LeafEffectKind> = (effect: Extract<BattleCardEffect, { kind: K }>) => KeywordId[];

const PRESENTATION: { [K in LeafEffectKind]: EffectPresentation<K> } = {
  damage: (effect) =>
    effectKeywords(
      effect.damageTypePool?.length ? effect.damageTypePool : [effect.damageType],
      effect.lifesteal ? ["leech"] : [],
      effect.damageTypeIfTargetFrozen ? [effect.damageTypeIfTargetFrozen] : [],
      effect.equalToBlock ? ["block"] : [],
      effect.equalToArmor ? ["armor"] : [],
      effect.forgeBonusPercent !== undefined ? ["forge"] : [],
    ),
  "cleanse-player-status-to-damage": (effect) =>
    effectKeywords([effect.status, effect.damageType], effect.lifesteal ? ["leech"] : []),
  "random-damage": (effect) =>
    effectKeywords(
      effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES,
      effect.lifesteal ? ["leech"] : [],
    ),
  "player-status": (effect) =>
    effectKeywords(
      effect.statusPool ?? (effect.status !== "haste" && effect.status !== "phoenixFeather" ? [effect.status] : []),
      effect.perManaCrystal !== undefined || effect.convertCurrentMana !== undefined ? ["mana"] : [],
    ),
  heal: () => ["health"],
  "restore-mana": () => ["mana"],
  "lose-mana": () => ["mana"],
  "lose-max-mana": () => ["mana"],
  "gain-max-mana": () => ["mana"],
  "gain-gold": () => ["gold"],
  wish: (effect) => (effect.companionIfAbsent ? [] : ["wish"]),
  "summon-companion": () => ["companion"],
  "companion-action": () => ["companion"],
  "random-draw": () => [],
  "remove-harmful-status": () => [],
  "lose-health": () => ["health"],
  "draw-cards": () => [],
  "remove-enemy-armor": () => ["armor"],
  "multiply-enemy-status": (effect) => [effect.status],
  "remove-player-status": (effect) => [effect.status],
  "self-damage": (effect) => [effect.damageType],
  "next-hit-crit": () => [],
  "next-hit-leech": () => ["leech"],
  "play-next-card-twice": () => [],
  "next-hit-poison": () => ["poison"],
  "next-archery-free": () => ["archery"],
  "dodge-next-attack": () => ["dodge"],
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

function effectKeywords(...iterables: ReadonlyArray<readonly KeywordId[]>): KeywordId[] {
  return iterables.flat();
}

export function collectKeywordsFromBattleEffects(effects: readonly BattleCardEffect[]): KeywordId[] {
  const keywords = new Set<KeywordId>();
  visitBattleCardEffects(effects, (entry) => {
    if (entry.kind === "chance" || entry.kind === "repeat-over-turns") return;
    for (const keyword of PRESENTATION[entry.kind](entry as never)) keywords.add(keyword);
  });
  return [...keywords];
}
