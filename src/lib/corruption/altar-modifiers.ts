import { getCardKeywords, type BattleCard, type BattleCardEffect, type KeywordId } from "@/lib/game-data";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { CorruptionMutationGroup, Mutation } from "./mutation-types";

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
  let shaped = groups;
  if (modifiers.includes("steady-sigil")) {
    shaped = shaped.filter((group) => group.kind !== "weaken");
  }
  if (modifiers.includes("blood-rite")) {
    shaped = shaped.map((group) => {
      if (group.kind === "leech") return { ...group, weight: group.weight * 3 };
      if (group.kind === "convert") return { ...group, weight: group.weight * 2 };
      return group;
    });
  }
  if (modifiers.includes("echoing-altar")) {
    const keywords = new Set<KeywordId>(getCardKeywords(card));
    shaped = shaped.map((group) => {
      if (group.kind === "secondary")
        return { ...group, mutations: filterEchoMutations(group.mutations, keywords, addedKeyword) };
      if (group.kind === "convert")
        return { ...group, mutations: filterEchoMutations(group.mutations, keywords, convertedKeyword) };
      return group;
    });
  }
  return shaped;
}
