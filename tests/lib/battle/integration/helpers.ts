// Re-exports canonical battle test fixtures (see tests/fixtures/battle.ts).
import { defaultBattleState } from "@/lib/battle";
import { makeTestBattleState, makeTestCard } from "../../../fixtures/battle";

export { defaultBattleState };

/** Integration tests often mock Math.random — default rng uses it unless overridden. */
export const makeState = (overrides: Parameters<typeof makeTestBattleState>[0] = {}) =>
  makeTestBattleState({
    rng: Math.random,
    deck: [makeTestCard({ id: "d1" }), makeTestCard({ id: "d2" }), makeTestCard({ id: "d3" }), makeTestCard({ id: "d4" })],
    ...overrides,
  });

export const makeCard = makeTestCard;
