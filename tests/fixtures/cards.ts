import type { BattleCard } from "@/lib/game-data/types";

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
