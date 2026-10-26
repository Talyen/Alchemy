import {
  BattleCardEffectSchema,
  areBattleCardEffectsEqual,
  cloneBattleCard,
  createEffectDescription,
  carryCardDescriptionMarks,
  getCardDescription,
  getCardEffect,
  getStandardPotionPool,
  isPotionCard,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type CardDescription,
} from "@/lib/game-data";
import { POTION_DISTILL_BONUS, CAMPFIRE_POTION_OFFERS } from "@/lib/game-constants";
import { shuffle } from "@/lib/rng";
import { appendPotionTrailer, doublePotionPotency } from "./potion-mixer";
import type { EncounterRewardTraitId } from "../content-systems/encounter-traits";
import { distillPotionEffect } from "./potion-scaling";

export type BrewOperation =
  | { kind: "new"; offerIndex: number }
  | { kind: "combine"; indices: [number, number] }
  | { kind: "strengthen"; index: number };
export function getCampfireBrewKind(deck: readonly BattleCard[]): "new" | "combine" {
  let potions = 0;
  for (const card of deck) if (isPotionCard(card) && ++potions === 2) return "combine";
  return "new";
}

/** A distilled magnitude references a field whose value grew; mark exactly those. */
function markDistilledMagnitudes(
  description: CardDescription,
  before: readonly BattleCardEffect[],
  after: readonly BattleCardEffect[],
) {
  return description.map((line) => ({
    ...line,
    parts: line.parts.map((part) => {
      if (typeof part === "string") return part;
      const increased = part.references.some((reference) => {
        const beforeValue = (getCardEffect(before, reference) as Record<string, unknown> | undefined)?.[
          reference.field
        ];
        const afterValue = (getCardEffect(after, reference) as Record<string, unknown> | undefined)?.[reference.field];
        return (
          typeof afterValue === "number" &&
          (beforeValue === undefined || (typeof beforeValue === "number" && afterValue > beforeValue))
        );
      });
      return increased ? { ...part, distilled: true } : part;
    }),
  }));
}

export function strengthenPotion(card: BattleCard): BattleCard | null {
  if (!isPotionCard(card)) return null;
  const effects = card.effects.map(distillPotionEffect);
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
  const description = markDistilledMagnitudes(
    carryCardDescriptionMarks(getCardDescription(card), createEffectDescription(effects)),
    card.effects,
    effects,
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

const DEFENSIVE_POTION_IDS: ReadonlySet<string> = new Set(["health-potion", "stoneskin-potion", "panacea-potion"]);

export function createCampfirePotionOffers(rng: () => number): BattleCard[] {
  const pool = shuffle(getStandardPotionPool(), rng);
  const defensiveIndex = pool.findIndex((card) => DEFENSIVE_POTION_IDS.has(card.id));
  const ordered =
    defensiveIndex < 0
      ? pool
      : [pool[defensiveIndex]!, ...pool.slice(0, defensiveIndex), ...pool.slice(defensiveIndex + 1)];
  return ordered.slice(0, CAMPFIRE_POTION_OFFERS).map(cloneBattleCard);
}

export function applyStrongSpiritsToPotions(
  potions: BattleCard[],
  modifiers: readonly EncounterRewardTraitId[] = [],
): BattleCard[] {
  return modifiers.includes("strong-spirits") ? potions.map(doublePotionPotency) : potions;
}

/** Initial visits and save repair use the same shelf recipe and modifier order. */
export function createAlchemistBrewOffers(
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): BattleCard[] {
  return applyStrongSpiritsToPotions(createCampfirePotionOffers(rng), modifiers);
}
