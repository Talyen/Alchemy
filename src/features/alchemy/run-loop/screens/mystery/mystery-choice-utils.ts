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
  "gainRandomGear",
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

export interface ResolvedMysteryRewardGrant {
  effect: MysteryEffect;
  grantedTrinketId?: string | undefined;
  grantedGear?: GearInstance | undefined;
}

export function pairMysteryEffectsWithGrants(
  effects: readonly MysteryEffect[],
  grantedTrinketIds: readonly string[],
  grantedGearInstances: readonly GearInstance[],
): ResolvedMysteryRewardGrant[] {
  let trinketIndex = 0;
  let gearIndex = 0;
  return effects.map((effect) => {
    let grantedTrinketId: string | undefined;
    let grantedGear: GearInstance | undefined;
    if (effect.kind === "gainRandomTrinket") {
      grantedTrinketId = grantedTrinketIds[trinketIndex++];
      if (grantedTrinketId === undefined) {
        grantedGear = grantedGearInstances[gearIndex++];
      }
    } else if (effect.kind === "gainRandomGear" || effect.kind === "gainGeneratedGear") {
      grantedGear = grantedGearInstances[gearIndex++];
    }
    return { effect, grantedTrinketId, grantedGear };
  });
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
  const paired = pairMysteryEffectsWithGrants(choice.effects, grantedTrinketIds, grantedGearInstances);

  for (const { effect, grantedTrinketId, grantedGear } of paired) {
    if (effect.kind === "gainXP") {
      keywords.add(effect.keyword);
    }
    const cardId = effect.kind === "addCard" ? effect.cardId : effect.kind === "chooseCard" ? chosenCardId : null;
    const card = cardId ? findCard(cardId) : undefined;
    if (card) for (const keyword of getCardKeywords(card)) keywords.add(keyword);
    const trinketId = effect.kind === "gainTrinket" ? effect.trinketId : grantedTrinketId;
    if (trinketId) for (const keyword of getTrinketKeywords(trinketId)) keywords.add(keyword);
    if (grantedGear) for (const keyword of getPlasmaKeywordsForGear(grantedGear)) keywords.add(keyword);
  }

  return Array.from(keywords);
}
