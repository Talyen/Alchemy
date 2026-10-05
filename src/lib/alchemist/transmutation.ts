import { getBattleCardTransmutationRole } from "@/lib/battle";
import { getOfferableCardPool, isMixedPotionCard, type BattleCard } from "@/lib/game-data";
import { cloneBattleCard } from "@/lib/game-data";
import { pickRandom } from "@/lib/rng";

export function isTransmutableCard(card: BattleCard): boolean {
  return !card.brewed && !isMixedPotionCard(card);
}

const TRANSMUTATION_POOLS: Record<"attack" | "defense" | "utility", BattleCard[]> = {
  attack: [],
  defense: [],
  utility: [],
};
for (const card of getOfferableCardPool()) {
  TRANSMUTATION_POOLS[card.transmutationRole ?? getBattleCardTransmutationRole(card)].push(card);
}

export function createTransmutationOffers(rng: () => number): BattleCard[] {
  // Pool order preserves role order and three seeded draws. Catalog metadata
  // stays unchanged so hydration restores the selected cards without extra fields.
  return Object.values(TRANSMUTATION_POOLS).flatMap((pool) => {
    const card = pickRandom(pool, rng);
    return card ? [cloneBattleCard(card)] : [];
  });
}
