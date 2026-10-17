import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";

import { getCardKeywords, type BattleCard, type KeywordId } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { getPlasmaKeywordsForGear } from "@/features/alchemy/shared/config";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";

export function choiceOffersCardSelection(choice: MysteryChoice) {
  return choice.effects.some((e) => e.kind === "chooseCard");
}

export interface ResolvedMysteryRewardGrant {
  effect: MysteryEffect;
  grantedGear?: GearInstance | undefined;
}

export function pairMysteryEffectsWithGrants(
  effects: readonly MysteryEffect[],
  grantedGearInstances: readonly GearInstance[],
): ResolvedMysteryRewardGrant[] {
  let gearIndex = 0;
  return effects.map((effect) => {
    const grantedGear =
      effect.kind === "gainRandomGear" || effect.kind === "gainGeneratedGear"
        ? grantedGearInstances[gearIndex++]
        : undefined;
    return { effect, grantedGear };
  });
}

export function getPlasmaKeywordsForMysteryReward({
  choice,
  findCard,
  grantedGearInstances,
  chosenCardId,
}: {
  choice: MysteryChoice;
  grantedGearInstances: GearInstance[];
  chosenCardId: string | null;
  findCard: (id: string) => BattleCard | undefined;
}): KeywordId[] {
  const keywords = new Set<KeywordId>();
  const paired = pairMysteryEffectsWithGrants(choice.effects, grantedGearInstances);

  for (const { effect, grantedGear } of paired) {
    if (effect.kind === "gainXP") {
      keywords.add(effect.keyword);
    }
    const cardId = effect.kind === "addCard" ? effect.cardId : effect.kind === "chooseCard" ? chosenCardId : null;
    const card = cardId ? findCard(cardId) : undefined;
    if (card) for (const keyword of getCardKeywords(card)) keywords.add(keyword);
    if (effect.kind === "gainTrinket") {
      for (const keyword of getTrinketKeywords(effect.trinketId)) keywords.add(keyword);
    }
    if (grantedGear) for (const keyword of getPlasmaKeywordsForGear(grantedGear)) keywords.add(keyword);
  }

  return Array.from(keywords);
}
