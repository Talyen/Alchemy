import { getStandardPotionPool, isPotionCard } from "@/lib/game-data/cards/card-pools";
import {
  areBattleCardEffectsEqual,
  cloneBattleCard,
  createEffectDescription,
  carryCardDescriptionMarks,
  getCardDescription,
  withCardDescription,
  mapEffectChildren,
  getCardEffect,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { POTION_DISTILL_BONUS, CAMPFIRE_POTION_OFFERS } from "@/lib/game-constants";
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { shuffle } from "@/lib/rng";

export type BrewOperation =
  | { kind: "new"; offerIndex: number }
  | { kind: "combine"; indices: [number, number] }
  | { kind: "strengthen"; index: number };
export function isBrewablePotion(card: BattleCard): boolean {
  return isPotionCard(card);
}

export function getCampfireBrewKind(deck: readonly BattleCard[]): "new" | "combine" {
  return deck.filter(isBrewablePotion).length >= 2 ? "combine" : "new";
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
    effect.kind === "wish" ||
    effect.kind === "damage" ||
    effect.kind === "player-status"
  ) {
    return { ...effect, amount: effect.amount + POTION_DISTILL_BONUS };
  }
  return mapEffectChildren(effect, strengthenEffect);
}

export function strengthenPotion(card: BattleCard): BattleCard | null {
  if (!isBrewablePotion(card)) return null;
  const effects = card.effects.map(strengthenEffect);
  if (
    effects.some((effect) => effect.kind === "remove-harmful-status" && effect.removeAll) &&
    !effects.some((effect) => effect.kind === "heal")
  ) {
    effects.push({ kind: "heal", amount: POTION_DISTILL_BONUS });
  }
  if (
    effects.length === card.effects.length &&
    effects.every((effect, index) => areBattleCardEffectsEqual(effect, card.effects[index]!))
  )
    return null;
  const description = carryCardDescriptionMarks(getCardDescription(card), createEffectDescription(effects)).map(
    (line) => ({
      ...line,
      parts: line.parts.map((part) => {
        if (typeof part === "string") return part;
        const increased = part.references.some((reference) => {
          const before = getCardEffect(card.effects, reference);
          const after = getCardEffect(effects, reference);
          return (
            after &&
            reference.field === "amount" &&
            "amount" in after &&
            typeof after.amount === "number" &&
            (!before || ("amount" in before && typeof before.amount === "number" && after.amount > before.amount))
          );
        });
        return increased ? { ...part, distilled: true } : part;
      }),
    }),
  );
  if (card.consume) description.push({ parts: [CONSUME_DESCRIPTION_LINE], role: "consume" });
  return cloneBattleCard(
    withCardDescription(
      {
        ...card,
        effects,
      },
      description,
    ),
  );
}
export function createCampfirePotionOffers(rng: () => number): BattleCard[] {
  const pool = shuffle(getStandardPotionPool(), rng);
  const defensive = pool.find((card) => ["health-potion", "stoneskin-potion", "panacea-potion"].includes(card.id));
  return (defensive ? [defensive, ...pool.filter((card) => card.id !== defensive.id)] : pool)
    .slice(0, CAMPFIRE_POTION_OFFERS)
    .map(cloneBattleCard);
}
