import { describe, expect, it } from "vitest";
import { campaignLootDepth, labyrinthLootDepth } from "@/lib/loot";
import { gridLabyrinthMapFixture, twoFloorLabyrinthMapFixture } from "../../fixtures/labyrinth-map";

describe("loot depth", () => {
  it("counts the opening Campaign battle, every destination, and Act transitions without resetting", () => {
    expect(campaignLootDepth(1, 0)).toBe(1);
    expect(campaignLootDepth(1, 1)).toBe(2);
    expect(campaignLootDepth(1, 8)).toBe(9);
    expect(campaignLootDepth(2, 1)).toBe(10);
    expect(campaignLootDepth(3, 8)).toBe(25);
  });

  it("counts all newly cleared Labyrinth rooms equally, including side rooms, but not entrances or revisits", () => {
    const map = gridLabyrinthMapFixture();
    const rooms = Object.values(map.nodes).filter((node) => node.type !== "entrance");
    expect(labyrinthLootDepth(map, rooms[0].id)).toBe(1);
    const completed = ["shop", "rest", "mystery"].map((type) => rooms.find((node) => node.type === type)!);
    for (const node of completed) node.cleared = true;
    const pending = rooms.find((node) => node.id.includes("side"))!;
    expect(labyrinthLootDepth(map, pending.id)).toBe(4);
    pending.cleared = true;
    expect(labyrinthLootDepth(map, pending.id)).toBe(4);
    expect(labyrinthLootDepth(map)).toBe(5);
    for (const node of completed) node.type = "combat";
    expect(labyrinthLootDepth(map, pending.id)).toBe(4);
  });

  it("retains completed-room progress across floors and does not count skipped rooms", () => {
    const map = twoFloorLabyrinthMapFixture();
    const completed = Object.values(map.nodes).filter((node) => node.cleared && node.type !== "entrance");
    expect(labyrinthLootDepth(map)).toBe(completed.length + 1);
    completed[0].cleared = false;
    expect(labyrinthLootDepth(map)).toBe(completed.length);
  });
});
