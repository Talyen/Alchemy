import type { BattleCard, KeywordId } from "@/lib/game-data";
import { cardHasKeyword } from "@/lib/game-data";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";
import type { ContentSystemId } from "../types";
import type { EncounterRewardTraitId } from "../encounter-traits";
import type { MysteryEvent } from "@/lib/mystery/types";

// Route selectors compare this reference shallowly; fresh arrays trigger render loops.
const NO_LABYRINTH_BENEFITS: readonly EncounterRewardTraitId[] = Object.freeze([]);

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

// Order preserves the selection priority when a restored room has multiple bonuses.
const MYSTERY_REWARDS = [
  ["golden-omen", "gainGold"],
  ["bountiful", "gainMaterial"],
  ["enlightening", "gainXP"],
] as const;

export function labyrinthCardShopPool<T extends readonly BattleCard[]>(
  pool: T,
  modifiers: readonly EncounterRewardTraitId[],
): T | BattleCard[] {
  let theme: KeywordId | undefined;
  for (const id of modifiers) {
    theme = MARKET_THEMES[id];
    if (theme !== undefined) break;
  }
  return theme ? pool.filter((card) => cardHasKeyword(card, theme)) : pool;
}

export function labyrinthCampfireHealing(baseFraction: number, modifiers: readonly EncounterRewardTraitId[]): number {
  if (modifiers.includes("healing-spring")) return 1;
  return Math.min(1, baseFraction * (modifiers.includes("deep-rest") ? LABYRINTH_MODIFIER_CONFIG.double : 1));
}

export function labyrinthMysteryEligibility(modifiers: readonly EncounterRewardTraitId[]) {
  const preferredKind = MYSTERY_REWARDS.find(([id]) => modifiers.includes(id))?.[1];
  return (event: MysteryEvent): boolean =>
    event.choices.some((choice) => choice.effects.some((effect) => !preferredKind || effect.kind === preferredKind));
}

export function isLabyrinthMysteryEligible(event: MysteryEvent, modifiers: readonly EncounterRewardTraitId[]): boolean {
  return labyrinthMysteryEligibility(modifiers)(event);
}

export function applyLabyrinthMysteryModifiers(
  event: MysteryEvent,
  modifiers: readonly EncounterRewardTraitId[],
  maxHealth: number,
): MysteryEvent {
  if (modifiers.length === 0) return event;
  const boostedKinds: Array<(typeof MYSTERY_REWARDS)[number][1]> = [];
  for (const [id, kind] of MYSTERY_REWARDS) {
    if (modifiers.includes(id)) boostedKinds.push(kind);
  }
  const healing =
    modifiers.includes("restful-discovery") && maxHealth > 0
      ? Math.max(1, Math.round(maxHealth * LABYRINTH_MODIFIER_CONFIG.restfulDiscoveryHealing))
      : null;
  if (!boostedKinds.length && healing === null) return event;
  return {
    ...event,
    choices: event.choices.map((choice) => ({
      ...choice,
      effects: [
        ...choice.effects.map((effect) => {
          if ("amount" in effect && boostedKinds.some((kind) => kind === effect.kind)) {
            return { ...effect, amount: effect.amount * LABYRINTH_MODIFIER_CONFIG.double };
          }
          return effect;
        }),
        ...(healing === null ? [] : [{ kind: "healHealth" as const, amount: healing }]),
      ],
    })),
  };
}
