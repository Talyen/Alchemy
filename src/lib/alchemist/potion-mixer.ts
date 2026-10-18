import { capitalizeWord, isValidDeckIndex } from "@/lib/utils";
import {
  CONSUME_DESCRIPTION_LINE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_COST,
  MIXED_POTION_TITLE,
} from "../game-constants";
import type { BattleCard, BattleCardEffect, CardDescription } from "../game-data";
import {
  BattleCardEffectSchema,
  areBattleCardEffectsEqual,
  cloneBattleCard,
  createEffectDescription,
  carryCardDescriptionMarks,
  getCardDescription,
  mapCardDescriptionReferences,
  withCardDescription,
  mapEffectChildren,
  mixedPotion,
  visitBattleCardEffects,
} from "../game-data";

function doublePotionEffect(effect: BattleCardEffect): BattleCardEffect {
  // Doubling changes rewards, never ingredient costs, status durations, or derived/conversion base amounts.
  if (
    effect.kind === "lose-health" ||
    effect.kind === "self-damage" ||
    effect.kind === "lose-mana" ||
    effect.kind === "lose-max-mana" ||
    (effect.kind === "damage" && (effect.equalToBlock === true || effect.equalToArmor === true)) ||
    (effect.kind === "player-status" &&
      (effect.status === "haste" ||
        effect.status === "phoenixFeather" ||
        effect.convertCurrentMana !== undefined ||
        effect.perManaCrystal !== undefined))
  )
    return effect;
  if (effect.kind === "random-draw" || effect.kind === "random-damage") {
    return {
      ...effect,
      minAmount: effect.minAmount * 2,
      maxAmount: effect.maxAmount * 2,
    };
  }
  if ("amount" in effect && typeof effect.amount === "number") {
    const amount = effect.amount * 2;
    if (effect.kind === "damage")
      return {
        ...effect,
        amount,
        ...(effect.amountIfTargetFrozen !== undefined ? { amountIfTargetFrozen: effect.amountIfTargetFrozen * 2 } : {}),
      };
    if (effect.kind === "player-status" && effect.forgeAmount !== undefined)
      return { ...effect, amount, forgeAmount: effect.forgeAmount * 2 };
    return { ...effect, amount };
  }
  return mapEffectChildren(effect, doublePotionEffect);
}

/** Shared keyword/consume trailer so mixed, doubled, and distilled potions read alike. */
export function appendPotionTrailer(
  description: CardDescription,
  tags: readonly string[] | undefined,
  consume: boolean,
): void {
  for (const tag of tags ?? []) description.push({ parts: [capitalizeWord(tag)], role: "keyword" });
  if (consume) description.push({ parts: [CONSUME_DESCRIPTION_LINE], role: "consume" });
}

function potionParts(card: BattleCard, effects = card.effects) {
  return {
    effects,
    description: carryCardDescriptionMarks(getCardDescription(card), createEffectDescription(effects)),
  };
}

function prepareMixedPotion(cardA: BattleCard, cardB: BattleCard): BattleCard | null {
  const tags = [...new Set([...(cardA.tags ?? []), ...(cardB.tags ?? [])])];
  // Folding must represent both executions. Costs, durations and derived
  // magnitudes are deliberately unchanged by potency, so keep those packets.
  const sameCard =
    cardA.id === cardB.id &&
    cardA.effects.length === cardB.effects.length &&
    cardA.effects.every((effect, index) => areBattleCardEffectsEqual(effect, cardB.effects[index]!)) &&
    !visitBattleCardEffects(
      cardA.effects,
      (effect) =>
        (effect.kind === "remove-enemy-armor" && effect.halve === true) ||
        effect.kind === "multiply-enemy-status" ||
        effect.kind === "lose-health" ||
        effect.kind === "self-damage" ||
        effect.kind === "lose-mana" ||
        effect.kind === "lose-max-mana" ||
        (effect.kind === "damage" &&
          (effect.equalToBlock === true || effect.equalToArmor === true || effect.forgeBonusPercent !== undefined)) ||
        (effect.kind === "player-status" &&
          (effect.status === "haste" ||
            effect.status === "phoenixFeather" ||
            effect.convertCurrentMana !== undefined ||
            effect.perManaCrystal !== undefined)),
    );

  const doubled = sameCard ? cardA.effects.map(doublePotionEffect) : null;
  // Folding is optional: two valid ingredients must still mix when their
  // doubled amounts exceed the saved-effect bounds. Keep both effect sets.
  const combinedEffects = doubled?.every((effect) => BattleCardEffectSchema.safeParse(effect).success) ? doubled : null;
  // Reject before generating descriptions or spending either ingredient.
  if (
    !combinedEffects &&
    [cardA, cardB].some((card) => card.effects.some((effect) => !BattleCardEffectSchema.safeParse(effect).success))
  )
    return null;
  const parts = combinedEffects ? [potionParts(cardA, combinedEffects)] : [potionParts(cardA), potionParts(cardB)];
  if (combinedEffects) {
    const part = parts[0]!;
    part.description = carryCardDescriptionMarks(getCardDescription(cardB), part.description);
  }

  let effectOffset = 0;
  const description = parts.flatMap((part) => {
    const offset = effectOffset;
    effectOffset += part.effects.length;
    return mapCardDescriptionReferences(
      part.description,
      (reference) => ({
        ...reference,
        effectIndex: reference.effectIndex + offset,
      }),
      `ingredient/${offset}`,
    );
  });
  appendPotionTrailer(description, tags, true);
  return cloneBattleCard(
    withCardDescription(
      {
        id: `${MIXED_POTION_CARD_ID}-crafted`,
        title: MIXED_POTION_TITLE,
        descriptionLines: [],
        art: mixedPotion,
        cost: MIXED_POTION_COST,
        consume: true,
        ...(tags.length ? { tags } : {}),
        effects: parts.flatMap((part) => part.effects),
      },
      description,
    ),
  );
}

export function createMixedPotion(cardA: BattleCard, cardB: BattleCard): BattleCard {
  const potion = prepareMixedPotion(cardA, cardB);
  if (!potion) throw new Error("Mixed Potion effects exceed supported values");
  return potion;
}

export function tryCreateMixedPotion(cardA: BattleCard | undefined, cardB: BattleCard | undefined): BattleCard | null {
  if (!cardA || !cardB) return null;
  return prepareMixedPotion(cardA, cardB);
}

export function applyMixToDeck(deck: BattleCard[], indexA: number, indexB: number, mixed: BattleCard): BattleCard[] {
  if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
    throw new Error("Invalid potion indices for mixing");
  }
  return [...deck.filter((_, index) => index !== indexA && index !== indexB), mixed];
}

export function doublePotionPotency(card: BattleCard): BattleCard {
  const { effects, description } = potionParts(card, card.effects.map(doublePotionEffect));
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
