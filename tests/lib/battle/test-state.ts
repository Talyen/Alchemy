// Shared minimal BattleState factory for battle unit tests.
import type { BattleState } from "@/lib/battle/types";
import { defaultBattleState } from "@/lib/battle/draw";

export function createTestBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    ...defaultBattleState(),
    mana: 4,
    maxMana: 4,
    ...overrides,
  };
}
