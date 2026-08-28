import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";

import { getCardKeywords, type BattleCard, type KeywordId } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { getPlasmaKeywordsForGear } from "@/features/alchemy/shared/config";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";

const POSITIVE_MYSTERY_EFFECT_KINDS = new Set<MysteryEffect["kind"]>([
  "addCard",
  "chooseCard",
  "gainTrinket",
  "gainRandomTrinket",
  "gainGeneratedGear",
  "healHealth",
  "gainGold",
  "gainXP",
  "gainMaterial",
]);

export function hasPositiveMysteryEffect(effects: MysteryEffect[]) {
  return effects.some((e) => POSITIVE_MYSTERY_EFFECT_KINDS.has(e.kind));
}

export function choiceOffersCardSelection(choice: MysteryChoice) {
  return choice.effects.some((e) => e.kind === "chooseCard");
}

export function choiceHasDisplayableSummary(choice: MysteryChoice): boolean {
  return choice.effects.some((effect) => effect.kind !== "removeCard");
}

export function getPlasmaKeywordsForMysteryReward({
  choice,
  findCard,
  grantedTrinketIds,
  grantedGearInstances,
  chosenCardId,
}: {
  choice: MysteryChoice;
  grantedTrinketIds: string[];
  grantedGearInstances: GearInstance[];
  chosenCardId: string | null;
  findCard: (id: string) => BattleCard | undefined;
}): KeywordId[] {
  const keywords = new Set<KeywordId>();
  let randomTrinketCursor = 0;
  let generatedGearCursor = 0;

  for (const effect of choice.effects) {
    if (effect.kind === "gainXP") {
      keywords.add(effect.keyword);
    } else if (effect.kind === "addCard") {
      const card = findCard(effect.cardId);
      if (card) {
        for (const kw of getCardKeywords(card)) keywords.add(kw);
      }
    } else if (effect.kind === "chooseCard") {
      const card = chosenCardId ? findCard(chosenCardId) : undefined;
      if (card) {
        for (const kw of getCardKeywords(card)) keywords.add(kw);
      }
    } else if (effect.kind === "gainTrinket") {
      for (const kw of getTrinketKeywords(effect.trinketId)) keywords.add(kw);
    } else if (effect.kind === "gainRandomTrinket") {
      const trinketId = grantedTrinketIds[randomTrinketCursor++];
      if (trinketId) {
        for (const kw of getTrinketKeywords(trinketId)) keywords.add(kw);
      }
    } else if (effect.kind === "gainGeneratedGear") {
      const gear = grantedGearInstances[generatedGearCursor++];
      if (gear) {
        for (const kw of getPlasmaKeywordsForGear(gear)) keywords.add(kw);
      }
    }
  }

  return Array.from(keywords);
}
