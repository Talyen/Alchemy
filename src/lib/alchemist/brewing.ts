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
  if (
    effect.kind === "player-status" &&
    (effect.status === "haste" || effect.status === "phoenixFeather" || effect.convertCurrentMana !== undefined)
  )
    return effect;
  if (effect.kind === "damage" && (effect.equalToBlockPercent !== undefined || effect.equalToGoldPercent !== undefined))
    return effect;
  if (
    effect.kind === "heal" ||
    effect.kind === "restore-mana" ||
    effect.kind === "gain-gold" ||
    effect.kind === "damage" ||
    effect.kind === "player-status"
  ) {
    return { ...effect, amount: Math.round(effect.amount * POTION_STRENGTHEN_MULTIPLIER) };
  }
  return mapEffectChildren(effect, strengthenEffect);
}

export function strengthenPotion(card: BattleCard): BattleCard | null {
  if (!isBrewablePotion(card)) return null;
  const effects = card.effects.map(strengthenEffect);
  if (effects.every((effect, index) => areBattleCardEffectsEqual(effect, card.effects[index]!))) return null;
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
