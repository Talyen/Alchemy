import type { BattleCard } from "@/lib/game-data";
import { defaultBattleState } from "@/lib/battle";
import type { BattleState } from "@/lib/battle/types";

export function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return { ...defaultBattleState(), ...overrides };
}

export function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
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

export { defaultBattleState };
