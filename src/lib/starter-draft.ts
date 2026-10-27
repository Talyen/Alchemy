import { getOfferableCardPool, selectRewardCards, type BattleCard } from "./game-data";
import { DRAFT_CHOICES } from "./game-constants";
import { getImmediateDamage, getImmediateDefense } from "./battle";

export function createStarterDraftChoices(draftedCards: BattleCard[], rng: () => number): BattleCard[] {
  const pool = getOfferableCardPool();
  const selected: BattleCard[] = [];
  const attacks: BattleCard[] = [];
  const defenses: BattleCard[] = [];
  for (const card of pool) {
    if (card.consume) continue;
    if (getImmediateDamage(card) > 0) attacks.push(card);
    if (getImmediateDefense(card) > 0) defenses.push(card);
  }
  for (const eligible of [attacks, defenses]) {
    selected.push(...selectRewardCards(draftedCards, eligible, 1, [...draftedCards, ...selected], rng));
  }
  selected.push(
    ...selectRewardCards(draftedCards, pool, DRAFT_CHOICES - selected.length, [...draftedCards, ...selected], rng),
  );
  return selected;
}
