import type { BattleCard, KeywordId } from "@/lib/game-data";
import { getCardKeywords } from "@/lib/game-data";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";
import type { ContentSystemId } from "../types";
import type { EncounterRewardTraitId } from "../encounter-traits";
import type { MysteryEvent } from "@/lib/mystery/types";

const NO_LABYRINTH_BENEFITS: readonly EncounterRewardTraitId[] = [];

export function activeLabyrinthBenefits(
  contentSystemType: ContentSystemId,
  modifiers: readonly EncounterRewardTraitId[],
): readonly EncounterRewardTraitId[] {
  return contentSystemType === "labyrinth" ? modifiers : NO_LABYRINTH_BENEFITS;
}

const MARKET_THEMES: Partial<Record<EncounterRewardTraitId, KeywordId>> = {
  "fletchers-market": "archery",
  "beast-market": "companion",
  "ember-market": "burn",
  "wishing-market": "wish",
};

export function labyrinthCardShopPool(pool: BattleCard[], modifiers: readonly EncounterRewardTraitId[]): BattleCard[] {
  const theme = modifiers.map((id) => MARKET_THEMES[id]).find((value) => value !== undefined);
  return theme ? pool.filter((card) => getCardKeywords(card).includes(theme)) : pool;
}

export function labyrinthCampfireHealing(baseFraction: number, modifiers: readonly EncounterRewardTraitId[]): number {
  if (modifiers.includes("healing-spring")) return 1;
  return Math.min(1, baseFraction * (modifiers.includes("deep-rest") ? LABYRINTH_MODIFIER_CONFIG.double : 1));
}

export function isLabyrinthMysteryEligible(event: MysteryEvent, modifiers: readonly EncounterRewardTraitId[]): boolean {
  return event.choices.some((choice) =>
    choice.effects.some((effect) =>
      modifiers.includes("golden-omen")
        ? effect.kind === "gainGold"
        : modifiers.includes("bountiful")
          ? effect.kind === "gainMaterial"
          : modifiers.includes("enlightening")
            ? effect.kind === "gainXP"
            : true,
    ),
  );
}

export function applyLabyrinthMysteryModifiers(
  event: MysteryEvent,
  modifiers: readonly EncounterRewardTraitId[],
  maxHealth: number,
): MysteryEvent {
  if (modifiers.length === 0) return event;
  return {
    ...event,
    choices: event.choices.map((choice) => ({
      ...choice,
      effects: [
        ...choice.effects.map((effect) => {
          if (
            (effect.kind === "gainGold" && modifiers.includes("golden-omen")) ||
            (effect.kind === "gainMaterial" && modifiers.includes("bountiful")) ||
            (effect.kind === "gainXP" && modifiers.includes("enlightening"))
          ) {
            return { ...effect, amount: effect.amount * LABYRINTH_MODIFIER_CONFIG.double };
          }
          return effect;
        }),
        ...(modifiers.includes("restful-discovery")
          ? [
              {
                kind: "healHealth" as const,
                amount: Math.round(maxHealth * LABYRINTH_MODIFIER_CONFIG.restfulDiscoveryHealing),
              },
            ]
          : []),
      ],
    })),
  };
}
