import { isMixedPotionCard, type BattleCard } from "@/lib/game-data";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CORRUPTION_TRANSFORM_CHANCE_FRACTION } from "@/lib/game-constants";
import { pickRandom, pickWeighted } from "@/lib/rng";
import { getCorruptionMutationGroups, type CorruptionMutationGroup } from "./mutations";

export { getEditableCorruptionTargets, replaceNumberAt, updateCardNumericValue } from "./numeric";

export interface CorruptionResult {
  originalCard: BattleCard;
  corruptedCard: BattleCard;
  transformed: boolean;
  delta: 1 | -1;
}

export const isSpecialCorruptionCard = isMixedPotionCard;

function pickMutation(groups: CorruptionMutationGroup[], rng: () => number) {
  const group = pickWeighted(groups, (entry) => entry.weight, rng);
  if (!group) return undefined;
  const mutation = pickRandom(group.mutations, rng);
  return mutation ? { ...mutation, kind: group.kind } : undefined;
}

function preserveCardUid(card: BattleCard, uid: BattleCard["uid"]): BattleCard {
  const result = { ...card };
  if (uid !== undefined) result.uid = uid;
  else delete result.uid;
  return result;
}

export function corruptCard(
  selectedCard: BattleCard,
  library: BattleCard[],
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): CorruptionResult | null {
  if (selectedCard.corrupted) return null;
  const pure = modifiers.includes("pure-altar");
  const twin = modifiers.includes("twin-offering");
  const singleModifiers = twin ? modifiers.filter((id) => id !== "twin-offering") : modifiers;
  let groups = getCorruptionMutationGroups(selectedCard, singleModifiers);
  let transformed = false;
  const candidates = library.filter(
    (card) => card.id !== selectedCard.id && !card.corrupted && !isSpecialCorruptionCard(card),
  );
  if (groups.length === 0 || (!pure && candidates.length > 0 && rng() < CORRUPTION_TRANSFORM_CHANCE_FRACTION)) {
    const options = candidates
      .map((card) => getCorruptionMutationGroups(card, singleModifiers))
      .filter((entries) => entries.length > 0);
    const picked = pickRandom(options, rng);
    if (picked) {
      groups = picked;
      transformed = true;
    }
  }
  if (groups.length === 0) return null;
  const mutation = pickMutation(groups, rng);
  if (!mutation) return null;
  let finalCard = mutation.card;
  let finalDelta = mutation.delta;
  if (twin) {
    const secondGroups = getCorruptionMutationGroups(mutation.card, singleModifiers).filter(
      (group) => group.kind !== mutation.kind && group.kind !== OPPOSITE_AXIS[mutation.kind],
    );
    const second = pickMutation(secondGroups, rng);
    if (second) {
      finalCard = second.card;
      finalDelta = mutation.delta === -1 && second.delta === -1 ? -1 : 1;
    }
  }
  return {
    originalCard: selectedCard,
    corruptedCard: preserveCardUid(finalCard, selectedCard.uid),
    transformed,
    delta: finalDelta,
  };
}

const OPPOSITE_AXIS: Partial<Record<CorruptionMutationGroup["kind"], CorruptionMutationGroup["kind"]>> = {
  strengthen: "weaken",
  weaken: "strengthen",
  consume: "reusable",
  reusable: "consume",
};

export function corruptDeckCard(
  deck: BattleCard[],
  cardIndex: number,
  library: BattleCard[],
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): { deck: BattleCard[]; result: CorruptionResult | null } {
  const selectedCard = deck[cardIndex];
  if (!selectedCard) throw new Error("Cannot corrupt a missing card");
  const result = corruptCard(selectedCard, library, rng, modifiers);
  if (!result) return { deck, result: null };
  return { deck: deck.map((card, index) => (index === cardIndex ? result.corruptedCard : card)), result };
}
