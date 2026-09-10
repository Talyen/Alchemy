import { describe, expect, it } from "vitest";
import { resolveAvailableDestinations } from "@/features/alchemy/shared/run-flow/resolve-available-destinations";
import { isMysteryLootEligible, mysteryPool } from "@/lib/mystery";
import { trinketLibrary } from "@/lib/game-data";
import { generateLabyrinthMap, expandBeyondBoss } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/rng";
import { DESTINATIONS } from "@/lib/routing";

describe("loot source availability", () => {
  it("offers Campaign Trinket shops only when the upcoming destination meets the depth requirement", () => {
    const input = {
      currentAct: 1,
      destinationIndexInAct: 5,
      completedDestinations: [],
      runPlayerHealth: 30,
      gold: 1000,
      runMaxHealth: 30,
      hasAnyOwnedGear: true,
    };
    expect(resolveAvailableDestinations(input)).not.toContain(DESTINATIONS.TRINKET_SHOP);
    expect(resolveAvailableDestinations({ ...input, destinationIndexInAct: 6 })).toContain(DESTINATIONS.TRINKET_SHOP);
    expect(resolveAvailableDestinations({ ...input, currentAct: 2, destinationIndexInAct: 0 })).toContain(
      DESTINATIONS.TRINKET_SHOP,
    );
  });

  it("leaves Boon events available early but gates their guaranteed Astral fallback when Boons are exhausted", () => {
    const event = mysteryPool.find((entry) => entry.id === "enchanted-spring")!;
    const early = { depth: 1, highestCompletedDifficulty: null };
    expect(isMysteryLootEligible(event, early, [])).toBe(true);
    const exhausted = trinketLibrary.map((entry) => entry.id);
    expect(isMysteryLootEligible(event, early, exhausted)).toBe(false);
    expect(isMysteryLootEligible(event, { ...early, depth: 4 }, exhausted)).toBe(true);
    expect(mysteryPool.filter((entry) => isMysteryLootEligible(entry, early, exhausted)).length).toBeGreaterThan(0);
  });

  it("generates early Labyrinth alternatives and only promises Masterwork where enough rooms must have been traversed", () => {
    let lateTrinketShops = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const rng = createSeededRng(seed);
      const map = generateLabyrinthMap(rng);
      const entrance = map.nodes[map.currentNodeId];
      expect(Object.values(map.nodes).some((node) => node.type === "trinket-shop")).toBe(false);
      for (const node of Object.values(map.nodes)) {
        if (node.rewardModifiers.includes("masterwork")) {
          expect(
            Math.abs(node.gridPosition.row - entrance.gridPosition.row) +
              Math.abs(node.gridPosition.col - entrance.gridPosition.col),
          ).toBeGreaterThanOrEqual(4);
        }
        node.cleared = true;
      }
      const boss = Object.values(map.nodes).find((node) => node.type === "boss")!;
      const expanded = expandBeyondBoss(map, boss.id, rng);
      lateTrinketShops += Object.values(expanded.nodes).filter(
        (node) => node.floor === 2 && node.type === "trinket-shop",
      ).length;
    }
    expect(lateTrinketShops).toBeGreaterThan(0);
  });
});
