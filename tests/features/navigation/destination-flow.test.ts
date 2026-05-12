import { describe, expect, it, vi } from "vitest";
import { getRunAvailableDestinations, sampleDestinationChoices } from "@/features/alchemy/navigation/destination-flow";

vi.mock("@/features/alchemy/config", () => ({
  getAvailableDestinations: vi.fn(() => ["Normal Combat", "Elite Combat", "Merchant's Shop", "Alchemist's Shop", "Mystery", "Campfire"]),
}));

describe("getRunAvailableDestinations", () => {
  it("returns only Boss Combat at last index in act", () => {
    const result = getRunAvailableDestinations({ destinationIndexInAct: 7, currentHp: 30, currentGold: 100, maxHp: 30 });
    expect(result).toEqual(["Boss Combat"]);
  });

  it("returns filtered destinations for non-last positions", () => {
    const result = getRunAvailableDestinations({ destinationIndexInAct: 2, currentHp: 30, currentGold: 100, maxHp: 30 });
    expect(result).toContain("Normal Combat");
    expect(result).not.toContain("Boss Combat");
  });

  it("returns filtered destinations at index 0", () => {
    const result = getRunAvailableDestinations({ destinationIndexInAct: 0, currentHp: 30, currentGold: 100, maxHp: 30 });
    expect(result).toContain("Normal Combat");
    expect(result).not.toContain("Boss Combat");
  });
});

describe("sampleDestinationChoices", () => {
  it("returns N sampled destinations", () => {
    const destinations: string[] = ["Normal Combat", "Elite Combat", "Campfire", "Mystery"];
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
});
