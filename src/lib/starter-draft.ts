import { getOfferableCardPoolView, selectRewardCards, type BattleCard } from "./game-data";
import { DRAFT_CHOICES } from "./game-constants";
import { nominalCardValue } from "./battle/autoplay-draft-policy";

export function createStarterDraftChoices(draftedCards: BattleCard[], rng: () => number): BattleCard[] {
  const pool = getOfferableCardPoolView();
  const selected: BattleCard[] = [];
  const attacks: BattleCard[] = [];
  const defenses: BattleCard[] = [];
  for (const card of pool) {
    if (card.consume) continue;
    const value = nominalCardValue(card.effects);
    if (value.damage > 0) attacks.push(card);
    if (value.defense > 0) defenses.push(card);
  }
  for (const eligible of [attacks, defenses]) {
    selected.push(...selectRewardCards(draftedCards, eligible, 1, [...draftedCards, ...selected], rng));
  }
  selected.push(
    ...selectRewardCards(draftedCards, pool, DRAFT_CHOICES - selected.length, [...draftedCards, ...selected], rng),
  );
  return selected;
}
