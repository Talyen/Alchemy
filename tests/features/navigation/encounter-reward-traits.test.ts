// Cross-mode reward trait behavior tests.
import { describe, expect, it } from "vitest";
import {
  createWildwoodRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
  shouldGrantCompanionReward,
} from "@/features/alchemy/run-loop/navigation/reward-flow";

describe("encounter reward traits", () => {
  it("rolls card, trinket, or gear rewards equally in Wildwood", () => {
    expect(createWildwoodRewardState([], () => 0.1).rewardType).toBe("card");
    expect(createWildwoodRewardState([], () => 0.5).rewardType).toBe("trinket");
    expect(createWildwoodRewardState([], () => 0.9).rewardType).toBe("gear");
  });

  it("shares Alchemist and Companion behavior across encounter modes", () => {
    const traits = getActiveRewardModifiersForContentSystem("wildwood", ["alchemist", "companion"]);
    expect(shouldGrantAlchemistReward(traits)).toBe(true);
    expect(shouldGrantCompanionReward(traits)).toBe(true);
  });
});
