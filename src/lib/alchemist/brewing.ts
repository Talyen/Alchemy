import { cloneBattleCard } from "@/lib/game-data";
import { getStandardPotionPool, isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import {
  areBattleCardEffectsEqual,
  describeCardEffects,
  mapEffectChildren,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { POTION_STRENGTHEN_MULTIPLIER, CAMPFIRE_POTION_OFFERS } from "@/lib/game-constants";
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { shuffle } from "@/lib/rng";

export type BrewOperation =
  | { kind: "new"; offerIndex: number }
  | { kind: "combine"; indices: [number, number] }
  | { kind: "strengthen"; index: number };
export function isBrewablePotion(card: BattleCard): boolean {
  return isStandardPotionCard(card) && !card.brewed;
}

function strengthenEffect(effect: BattleCardEffect): BattleCardEffect {
  const nested = mapEffectChildren(effect, strengthenEffect);
  if (
    (nested.kind === "heal" ||
      nested.kind === "restore-mana" ||
      nested.kind === "gain-gold" ||
      nested.kind === "damage" ||
      nested.kind === "player-status") &&
    "amount" in nested &&
    typeof nested.amount === "number" &&
    !(
      nested.kind === "player-status" &&
      (nested.status === "haste" || nested.status === "phoenixFeather" || nested.convertCurrentMana !== undefined)
    ) &&
    !(nested.kind === "damage" && (nested.equalToBlockPercent !== undefined || nested.equalToGoldPercent !== undefined))
  ) {
    return { ...nested, amount: Math.round(nested.amount * POTION_STRENGTHEN_MULTIPLIER) };
  }
  return nested;
}
export function strengthenPotion(card: BattleCard): BattleCard | null {
  if (!isBrewablePotion(card)) return null;
  const effects = card.effects.map(strengthenEffect);
  if (
    effects.every((effect, index) => {
      const original = card.effects[index];
      return original !== undefined && areBattleCardEffectsEqual(effect, original);
    })
  )
    return null;
  return {
    ...cloneBattleCard(card),
    brewed: true,
    effects,
    descriptionLines: [...describeCardEffects(effects), ...(card.consume ? [CONSUME_DESCRIPTION_LINE] : [])],
  };
}
export function createCampfirePotionOffers(rng: () => number): BattleCard[] {
  const pool = shuffle(getStandardPotionPool(), rng);
  const defensive = pool.find((card) => ["health-potion", "stoneskin-potion", "panacea-potion"].includes(card.id));
  return (defensive ? [defensive, ...pool.filter((card) => card.id !== defensive.id)] : pool)
    .slice(0, CAMPFIRE_POTION_OFFERS)
    .map(cloneBattleCard);
}
