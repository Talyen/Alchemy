// Re-exports canonical battle test fixtures (see tests/fixtures/battle.ts).
import { defaultBattleState } from "@/lib/battle";
import { makeTestBattleState, makeTestCard } from "../../../fixtures/battle";

export { defaultBattleState };

/** Default deck; rng uses Math.random so file-level spies control crit/proc rolls. Pass `rng: seededRng(n)` to override. */
export const makeState = (overrides: Parameters<typeof makeTestBattleState>[0] = {}) =>
  makeTestBattleState({
    rng: Math.random,
    deck: [makeTestCard({ id: "d1" }), makeTestCard({ id: "d2" }), makeTestCard({ id: "d3" }), makeTestCard({ id: "d4" })],
    ...overrides,
  });

export const makeCard = makeTestCard;
