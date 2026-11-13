import type { BattleCard, DamageType } from "@/lib/game-data/types";

export function makeTestCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test-card",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 1,
    effects: [],
    ...overrides,
  };
}

export function makeTestCardWithId(id: string, overrides: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({ id, title: id, ...overrides });
}

/** Plain hits in order; card overrides keep identity, cost, and tags explicit. */
export function makeDamageCard(
  damageType: DamageType,
  amounts: number | readonly number[],
  overrides: Omit<Partial<BattleCard>, "effects"> = {},
): BattleCard {
  const hits = typeof amounts === "number" ? [amounts] : amounts;
  return makeTestCard({
    ...overrides,
    effects: hits.map((amount) => ({ kind: "damage", damageType, amount })),
  });
}
