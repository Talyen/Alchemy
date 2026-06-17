import type { BattleCard } from "@/lib/game-data";

export function makeDiscoveryCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "fireball", title: "Fireball", descriptionLines: [""], art: "", cost: 2, effects: [], ...overrides };
}
