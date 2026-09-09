import type { BattleCard } from "@/lib/game-data";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CORRUPTION_TRANSFORM_CHANCE, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { pickRandom } from "@/lib/utils";
import { getCorruptionMutationGroups, type CorruptionMutationGroup } from "./mutations";

export { getEditableCorruptionTargets, replaceNumberAt, updateCardNumericValue } from "./numeric";

export interface CorruptionResult {
  originalCard: BattleCard;
  corruptedCard: BattleCard;
  transformed: boolean;
  delta: 1 | -1;
}

export function isSpecialCorruptionCard(card: Pick<BattleCard, "id">): boolean {
  return card.id === MIXED_POTION_CARD_ID || card.id.startsWith(`${MIXED_POTION_CARD_ID}-`);
}

function pickMutation(groups: CorruptionMutationGroup[], rng: () => number) {
  const total = groups.reduce((sum, group) => sum + group.weight, 0);
  let roll = rng() * total;
  for (const group of groups) {
    roll -= group.weight;
    if (roll < 0) return pickRandom(group.mutations, rng);
  }
  return undefined;
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
  if (groups.length === 0 || (!pure && candidates.length > 0 && rng() < CORRUPTION_TRANSFORM_CHANCE)) {
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
  if (!twin) {
    const corruptedCard = { ...mutation.card };
    if (selectedCard.uid !== undefined) corruptedCard.uid = selectedCard.uid;
    else delete corruptedCard.uid;
    return { originalCard: selectedCard, corruptedCard, transformed, delta: mutation.delta };
  }
  const firstKind = groups.find((entry) => entry.mutations.includes(mutation))?.kind;
  const secondGroups = getCorruptionMutationGroups(mutation.card, singleModifiers).filter(
    (group) => group.kind !== firstKind && !isOppositeAxis(firstKind, group.kind),
  );
  const second = pickMutation(secondGroups, rng);
  if (!second) {
    const corruptedCard = { ...mutation.card };
    if (selectedCard.uid !== undefined) corruptedCard.uid = selectedCard.uid;
    else delete corruptedCard.uid;
    return { originalCard: selectedCard, corruptedCard, transformed, delta: mutation.delta };
  }
  const corruptedCard = { ...second.card };
  if (selectedCard.uid !== undefined) corruptedCard.uid = selectedCard.uid;
  else delete corruptedCard.uid;
  return {
    originalCard: selectedCard,
    corruptedCard,
    transformed,
    delta: mutation.delta === -1 && second.delta === -1 ? -1 : 1,
  };
}

function isOppositeAxis(first: CorruptionMutationGroup["kind"] | undefined, second: CorruptionMutationGroup["kind"]) {
  return (first === "strengthen" && second === "weaken") || (first === "weaken" && second === "strengthen");
}

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
