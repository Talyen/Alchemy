import type { BattleCard } from "@/lib/game-data";
import { CORRUPTION_TRANSFORM_CHANCE, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { pickRandom } from "@/lib/utils";
import { getCorruptionMutationGroups, type CorruptionMutationGroup } from "./mutations";

export { getEditableCorruptionTargets, replaceNumberAt } from "./numeric";

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
): CorruptionResult | null {
  if (selectedCard.corrupted) return null;
  let groups = getCorruptionMutationGroups(selectedCard);
  let transformed = false;
  const candidates = library.filter(
    (card) => card.id !== selectedCard.id && !card.corrupted && !isSpecialCorruptionCard(card),
  );
  if (groups.length === 0 || (candidates.length > 0 && rng() < CORRUPTION_TRANSFORM_CHANCE)) {
    const options = candidates.map((card) => getCorruptionMutationGroups(card)).filter((entries) => entries.length > 0);
    const picked = pickRandom(options, rng);
    if (picked) {
      groups = picked;
      transformed = true;
    }
  }
  if (groups.length === 0) return null;
  const mutation = pickMutation(groups, rng);
  if (!mutation) return null;
  const corruptedCard = { ...mutation.card };
  if (selectedCard.uid !== undefined) corruptedCard.uid = selectedCard.uid;
  else delete corruptedCard.uid;
  return { originalCard: selectedCard, corruptedCard, transformed, delta: mutation.delta };
}

export function corruptDeckCard(
  deck: BattleCard[],
  cardIndex: number,
  library: BattleCard[],
  rng: () => number,
): { deck: BattleCard[]; result: CorruptionResult | null } {
  const selectedCard = deck[cardIndex];
  if (!selectedCard) throw new Error("Cannot corrupt a missing card");
  const result = corruptCard(selectedCard, library, rng);
  if (!result) return { deck, result: null };
  return { deck: deck.map((card, index) => (index === cardIndex ? result.corruptedCard : card)), result };
}
