import { getOfferableCardPool, isMixedPotionCard, type BattleCard } from "@/lib/game-data";
import { cloneBattleCard } from "@/lib/game-data";
import { pickRandom } from "@/lib/rng";
export function isTransmutableCard(card: BattleCard): boolean {
  return !card.brewed && !isMixedPotionCard(card);
}
export function createTransmutationOffers(rng: () => number): BattleCard[] {
  const pool = getOfferableCardPool();
  return (["attack", "defense", "utility"] as const).flatMap((role) => {
    const card = pickRandom(
      pool.filter((card) => card.transmutationRole === role),
      rng,
    );
    return card ? [cloneBattleCard(card)] : [];
  });
}
