import { getBattleCardTransmutationRole } from "@/lib/battle";
import { getOfferableCardPool, isMixedPotionCard, type BattleCard } from "@/lib/game-data";
import { cloneBattleCard } from "@/lib/game-data";
import { pickRandom } from "@/lib/rng";

export function isTransmutableCard(card: BattleCard): boolean {
  return !card.brewed && !isMixedPotionCard(card);
}

export function createTransmutationOffers(rng: () => number): BattleCard[] {
  const pools: Record<"attack" | "defense" | "utility", BattleCard[]> = { attack: [], defense: [], utility: [] };
  for (const card of getOfferableCardPool()) {
    pools[card.transmutationRole ?? getBattleCardTransmutationRole(card)].push(card);
  }
  return (["attack", "defense", "utility"] as const).flatMap((role) => {
    const card = pickRandom(pools[role], rng);
    // Inferred roles select offers; keep catalog metadata unchanged so hydration
    // restores the same cards without requiring extra persisted fields.
    return card ? [cloneBattleCard(card)] : [];
  });
}
