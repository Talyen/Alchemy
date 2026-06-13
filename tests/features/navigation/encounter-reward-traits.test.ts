// Cross-mode reward trait behavior tests.
import { describe, expect, it } from "vitest";
import {
  createWildwoodRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldForceTrinketReward,
  shouldGrantAlchemistReward,
  shouldGrantCompanionReward,
} from "@/features/alchemy/run-loop/navigation/reward-flow";

describe("encounter reward traits", () => {
  it("forces Wildwood trinket rewards for Collector", () => {
    const result = createWildwoodRewardState([], ["collector"], () => 0.99);
    expect(result.rewardType).toBe("trinket");
  });

  it("shares Alchemist and Companion behavior across encounter modes", () => {
    const traits = getActiveRewardModifiersForContentSystem("wildwood", ["alchemist", "companion"]);
    expect(shouldGrantAlchemistReward(traits)).toBe(true);
    expect(shouldGrantCompanionReward(traits)).toBe(true);
    expect(shouldForceTrinketReward(traits)).toBe(false);
  });
});
