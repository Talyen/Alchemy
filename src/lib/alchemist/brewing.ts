import { getStandardPotionPool, isPotionCard } from "@/lib/game-data/cards/card-pools";
import {
  BattleCardEffectSchema,
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
import { shuffle } from "@/lib/rng";
import { appendPotionTrailer } from "./potion-mixer";

export type BrewOperation =
  | { kind: "new"; offerIndex: number }
  | { kind: "combine"; indices: [number, number] }
  | { kind: "strengthen"; index: number };
export function getCampfireBrewKind(deck: readonly BattleCard[]): "new" | "combine" {
  let potions = 0;
  for (const card of deck) if (isPotionCard(card) && ++potions === 2) return "combine";
  return "new";
}

function strengthenEffect(effect: BattleCardEffect): BattleCardEffect {
  if (
    effect.kind === "player-status" &&
    (effect.status === "haste" ||
      effect.status === "phoenixFeather" ||
      effect.convertCurrentMana !== undefined ||
      effect.perManaCrystal !== undefined)
  )
    return effect;
  if (effect.kind === "damage" && (effect.equalToBlock === true || effect.equalToArmor === true)) return effect;
  if (effect.kind === "damage") {
    // A doubled Frozen outcome shares the displayed base magnitude.
    const frozenIncrease =
      effect.damageTypeIfTargetFrozen === effect.damageType && effect.amountIfTargetFrozen === effect.amount * 2
        ? POTION_DISTILL_BONUS * 2
        : POTION_DISTILL_BONUS;
    return {
      ...effect,
      amount: effect.amount + POTION_DISTILL_BONUS,
      ...(effect.amountIfTargetFrozen !== undefined
        ? { amountIfTargetFrozen: effect.amountIfTargetFrozen + frozenIncrease }
        : {}),
    };
  }
  if (effect.kind === "player-status")
    return {
      ...effect,
      amount: effect.amount + POTION_DISTILL_BONUS,
      ...(effect.forgeAmount !== undefined ? { forgeAmount: effect.forgeAmount + POTION_DISTILL_BONUS } : {}),
    };
  if (
    effect.kind === "heal" ||
    effect.kind === "restore-mana" ||
    effect.kind === "gain-gold" ||
    effect.kind === "wish" ||
    effect.kind === "companion-action"
  ) {
    return { ...effect, amount: effect.amount + POTION_DISTILL_BONUS };
  }
  return mapEffectChildren(effect, strengthenEffect);
}

export function strengthenPotion(card: BattleCard): BattleCard | null {
  if (!isPotionCard(card)) return null;
  const effects = card.effects.map(strengthenEffect);
  if (
    effects.some((effect) => effect.kind === "remove-harmful-status" && effect.removeAll) &&
    !effects.some((effect) => effect.kind === "heal")
  ) {
    effects.push({ kind: "heal", amount: POTION_DISTILL_BONUS });
  }
  if (effects.some((effect) => !BattleCardEffectSchema.safeParse(effect).success)) return null;
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
          const beforeValue = (before as Record<string, unknown> | undefined)?.[reference.field];
          const afterValue = (after as Record<string, unknown> | undefined)?.[reference.field];
          return (
            typeof afterValue === "number" &&
            (beforeValue === undefined || (typeof beforeValue === "number" && afterValue > beforeValue))
          );
        });
        return increased ? { ...part, distilled: true } : part;
      }),
    }),
  );
  appendPotionTrailer(description, card.tags, card.consume === true);
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
