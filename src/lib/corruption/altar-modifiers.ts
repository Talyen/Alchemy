import { getCardKeywords, type BattleCard, type BattleCardEffect, type KeywordId } from "@/lib/game-data";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { CorruptionMutationGroup, Mutation } from "./mutation-types";
import { CORRUPTION_BLOOD_RITE_BLEED_WEIGHT } from "@/lib/game-constants";

function secondaryKeyword(effect: BattleCardEffect): KeywordId | null {
  if (effect.kind === "player-status" && effect.status === "block") return "block";
  if (effect.kind === "heal") return "health";
  if (effect.kind === "damage" && (effect.damageType === "poison" || effect.damageType === "burn")) {
    return effect.damageType;
  }
  return null;
}

function filterEchoMutations(
  mutations: Mutation[],
  keywords: ReadonlySet<KeywordId>,
  keywordForCard: (card: BattleCard) => KeywordId | null,
): Mutation[] {
  const matching = mutations.filter(({ card }) => {
    const keyword = keywordForCard(card);
    return keyword !== null && keywords.has(keyword);
  });
  // Echo favors matching gifts without making an otherwise valid group empty.
  return matching.length > 0 ? matching : mutations;
}

function addedKeyword(card: BattleCard): KeywordId | null {
  const added = card.effects.at(-1);
  return added ? secondaryKeyword(added) : null;
}

function convertedKeyword(card: BattleCard): KeywordId | null {
  const effect = card.effects[0];
  return effect?.kind === "damage" ? effect.damageType : null;
}

export function applyAltarModifiers(
  groups: CorruptionMutationGroup[],
  card: BattleCard,
  modifiers: readonly EncounterRewardTraitId[],
): CorruptionMutationGroup[] {
  const steady = modifiers.includes("steady-sigil");
  const blood = modifiers.includes("blood-rite");
  const keywords = modifiers.includes("echoing-altar") ? new Set<KeywordId>(getCardKeywords(card)) : null;
  if (!steady && !blood && !keywords) return groups;

  return groups
    .filter((group) => !steady || group.kind !== "weaken")
    .map((group) => {
      const weight = group.weight * (blood && group.kind === "leech" ? 3 : blood && group.kind === "convert" ? 2 : 1);
      const keywordForCard =
        group.kind === "secondary" ? addedKeyword : group.kind === "convert" ? convertedKeyword : null;
      const matchingMutations =
        keywords && keywordForCard ? filterEchoMutations(group.mutations, keywords, keywordForCard) : group.mutations;
      // Mutation entries are sampled uniformly. Extra Bleed tickets favor the
      // promised damage type while retaining other conversions and Echo's restrictions.
      const mutations =
        blood && group.kind === "convert"
          ? matchingMutations.flatMap((mutation) =>
              convertedKeyword(mutation.card) === "bleed"
                ? Array.from({ length: CORRUPTION_BLOOD_RITE_BLEED_WEIGHT }, () => mutation)
                : [mutation],
            )
          : matchingMutations;
      return weight === group.weight && mutations === group.mutations ? group : { ...group, weight, mutations };
    });
}
