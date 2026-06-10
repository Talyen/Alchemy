// Shared minimal BattleState factory for battle unit tests.
import type { BattleState } from "@/lib/battle/types";
import { makeTestBattleState, makeTestCard, patchBattleState, seededRng } from "../../fixtures/battle";

export { makeTestCard, patchBattleState, seededRng };

/** Default battle test state; pass `rng: seededRng(42)` when rolls must be reproducible. */
export function createTestBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return makeTestBattleState(overrides);
}
