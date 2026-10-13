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
import { capitalizeWord } from "@/lib/utils";

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
    (effect.status === "haste" ||
      effect.status === "phoenixFeather" ||
      effect.convertCurrentMana !== undefined ||
      effect.perManaCrystal !== undefined)
  )
    return effect;
  if (
    effect.kind === "damage" &&
    (effect.equalToBlock === true ||
      effect.equalToArmor === true ||
      effect.equalToForge === true ||
      effect.equalToGoldPercent !== undefined)
  )
    return effect;
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
      ...(effect.blockDamageBonus !== undefined
        ? { blockDamageBonus: effect.blockDamageBonus + POTION_DISTILL_BONUS }
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
    effect.kind === "wish"
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
  for (const tag of card.tags ?? []) description.push({ parts: [capitalizeWord(tag)], role: "keyword" });
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
