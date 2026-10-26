import { getOfferableCardPool, selectRewardCards, type BattleCard } from "./game-data";
import { DRAFT_CHOICES } from "./game-constants";
import { getImmediateDamage, getImmediateDefense } from "./battle";

export function createStarterDraftChoices(draftedCards: BattleCard[], rng: () => number): BattleCard[] {
  const pool = getOfferableCardPool();
  const selected: BattleCard[] = [];
  for (const eligible of [
    pool.filter((card) => !card.consume && getImmediateDamage(card) > 0),
    pool.filter((card) => !card.consume && getImmediateDefense(card) > 0),
  ]) {
    selected.push(...selectRewardCards(draftedCards, eligible, 1, [...draftedCards, ...selected], rng));
  }
  selected.push(
    ...selectRewardCards(draftedCards, pool, DRAFT_CHOICES - selected.length, [...draftedCards, ...selected], rng),
  );
  return selected;
}
