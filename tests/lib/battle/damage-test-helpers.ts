import type { CombatTextEvent } from "@/lib/battle/types";
import type { BattleCardEffect, BattleCard } from "@/lib/game-data";

export function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    ...overrides,
  };
}

export function makeEffect(
  damageType: string,
  amount: number,
  extras: Partial<BattleCardEffect> = {},
): BattleCardEffect {
  return {
    kind: "damage",
    damageType: damageType as import("@/lib/game-data/types").DamageType,
    amount,
    ...extras,
  } as BattleCardEffect;
}

export function makeTexts(): CombatTextEvent[] {
  return [];
}
