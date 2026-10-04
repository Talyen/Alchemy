import { expect, it, vi } from "vitest";
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

it("honors the first guaranteed hoard without spending randomness on ordinary category selection", () => {
  const rng = vi.fn(() => 0.5);
  const input = { source: "trinket" as const, lootProgress: { depth: 24, highestCompletedDifficulty: null }, rng };
  const first = createRewardOffer({ ...input, rewardModifiers: ["armor-hoard", "ring-hoard"] });
  const firstDraws = rng.mock.calls.length;
  rng.mockClear();
  const plain = createRewardOffer({ ...input, rewardModifiers: ["armor-hoard"] });
  expect(first.rewardType).toBe("gear");
  if (first.rewardType !== "gear" || plain.rewardType !== "gear") throw new Error("Expected hoard gear");
  expect(first.choices.map((item) => item.definitionId)).toEqual(plain.choices.map((item) => item.definitionId));
  expect(first.choices.map((item) => item.affixes)).toEqual(plain.choices.map((item) => item.affixes));
  expect(firstDraws).toBe(rng.mock.calls.length);
  expect(first.choices).toHaveLength(3);
  expect(first.choices.every((item) => gearDefinitions[item.definitionId].compatibleSlots.includes("body"))).toBe(true);
});
