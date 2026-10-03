import { expect, it } from "vitest";
import { createRewardOffer } from "@/features/alchemy/run-loop/navigation/reward-offers";
import { trinketLibrary } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear";

it("replaces an exhausted Trinket Hoard with claimable Basic Gear", () => {
  const offer = createRewardOffer({
    source: "trinket",
    lootProgress: { depth: 24, highestCompletedDifficulty: null },
    ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
    rewardModifiers: ["trinket-hoard"],
    rng: () => 0.5,
  });
  expect(offer.rewardType).toBe("gear");
  expect(offer.choices).toHaveLength(3);
  if (offer.rewardType !== "gear") throw new Error("Expected fallback gear");
  expect(offer.choices.every((item) => gearDefinitions[item.definitionId]?.rarity === "basic")).toBe(true);
});
