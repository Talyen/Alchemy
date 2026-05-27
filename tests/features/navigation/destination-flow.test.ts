import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getDestinationWeight,
  getRunAvailableDestinations,
  restoreOrCreateDestinationRewardState,
  sampleDestinationChoices,
} from "@/features/alchemy/navigation/destination-flow";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { CORRUPTION_DESTINATION_WEIGHT, DEFAULT_DESTINATION_WEIGHT, PREVIOUS_DESTINATION_WEIGHT } from "@/lib/game-constants";

vi.mock("@/features/alchemy/config", () => ({
  getAvailableDestinations: vi.fn(() => ["Normal Combat", "Elite Combat", "Merchant's Shop", "Alchemist's Shop", "Mystery", "Corruption", "Campfire"]),
}));

describe("getRunAvailableDestinations", () => {
  it("returns only Boss Combat at last index in act", () => {
    const result = getRunAvailableDestinations({ destinationIndexInAct: 7, currentHealth: 30, currentGold: 100, maxHealth: 30 });
    expect(result).toEqual(["Boss Combat"]);
  });

  it("returns filtered destinations for non-last positions", () => {
    const result = getRunAvailableDestinations({ destinationIndexInAct: 2, currentHealth: 30, currentGold: 100, maxHealth: 30 });
    expect(result).toContain("Normal Combat");
    expect(result).toContain("Corruption");
    expect(result).not.toContain("Boss Combat");
  });

  it("returns filtered destinations at index 0", () => {
    const result = getRunAvailableDestinations({ destinationIndexInAct: 0, currentHealth: 30, currentGold: 100, maxHealth: 30 });
    expect(result).toContain("Normal Combat");
    expect(result).not.toContain("Boss Combat");
  });

  it("prevents Corruption after a Corruption destination", () => {
    const result = getRunAvailableDestinations({
      destinationIndexInAct: 2,
      currentHealth: 30,
      currentGold: 100,
      maxHealth: 30,
      previousDestination: "Corruption",
    });
    expect(result).not.toContain("Corruption");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("restoreOrCreateDestinationRewardState", () => {
  it("keeps existing destinations on resume", () => {
    const prev = createEmptyRewardState(["Campfire", "Mystery"]);
    const result = restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: ["Normal Combat"],
      bossEnemyId: "frostwarden",
    });
    expect(result.destinations).toEqual(["Campfire", "Mystery"]);
    expect(result.selectedBossId).toBeNull();
  });

  it("assigns boss id when resuming to a boss-only destination list", () => {
    const prev = createEmptyRewardState(["Boss Combat"]);
    const result = restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: ["Boss Combat"],
      bossEnemyId: "frostwarden",
    });
    expect(result.destinations).toEqual(["Boss Combat"]);
    expect(result.selectedBossId).toBe("frostwarden");
  });

  it("samples destinations when none are stored", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const prev = createEmptyRewardState();
    const available = ["Merchant's Shop", "Campfire", "Mystery"] as const;
    const result = restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: [...available],
      bossEnemyId: "skeleton",
    });
    expect(result.destinations.length).toBeGreaterThan(0);
    expect(result.destinations.every((destination) => available.includes(destination))).toBe(true);
  });
});

describe("sampleDestinationChoices", () => {
  it("returns N sampled destinations", () => {
    const destinations = ["Normal Combat", "Elite Combat", "Campfire", "Mystery"] as const;
    const result = sampleDestinationChoices(destinations);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((d) => destinations.includes(d))).toBe(true);
  });

  it("returns all destinations when fewer than requested count", () => {
    const result = sampleDestinationChoices(["Normal Combat"]);
    expect(result).toEqual(["Normal Combat"]);
  });

  it("handles empty array", () => {
    const result = sampleDestinationChoices([]);
    expect(result).toEqual([]);
  });

  it("weights Corruption like ordinary destinations", () => {
    expect(getDestinationWeight("Corruption")).toBe(CORRUPTION_DESTINATION_WEIGHT);
    expect(getDestinationWeight("Normal Combat")).toBe(DEFAULT_DESTINATION_WEIGHT);
    expect(getDestinationWeight("Corruption")).toBe(DEFAULT_DESTINATION_WEIGHT);
  });

  it("de-prioritizes the previous destination with reduced weight", () => {
    expect(getDestinationWeight("Campfire", "Campfire")).toBe(PREVIOUS_DESTINATION_WEIGHT);
    expect(getDestinationWeight("Campfire", "Corruption")).toBe(DEFAULT_DESTINATION_WEIGHT);
    expect(getDestinationWeight("Campfire")).toBe(DEFAULT_DESTINATION_WEIGHT);
  });

  it("de-prioritizes regardless of destination type when it was the previous", () => {
    expect(getDestinationWeight("Normal Combat", "Normal Combat")).toBe(PREVIOUS_DESTINATION_WEIGHT);
    expect(getDestinationWeight("Corruption", "Corruption")).toBe(PREVIOUS_DESTINATION_WEIGHT);
    expect(getDestinationWeight("Mystery", "Mystery")).toBe(PREVIOUS_DESTINATION_WEIGHT);
  });
});
