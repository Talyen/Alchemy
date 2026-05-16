// Unit tests for Labyrinth controller traversal guards.
// Depends on generated maps and the pure node-entry predicate exported by the hook module.
import { describe, expect, it } from "vitest";

import { canEnterLabyrinthNode } from "@/features/alchemy/use-labyrinth-controller";
import { createSeededRng, generateLabyrinthMap, setCurrentNode } from "@/lib/content-systems/labyrinth/map-generation";

describe("canEnterLabyrinthNode", () => {
  it("allows the opening current combat node to start the first Labyrinth fight", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    expect(canEnterLabyrinthNode(map, 0, 2)).toBe(true);
  });

  it("allows visible connected nodes", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const target = map.grid[0][2]!.connections[0];
    expect(canEnterLabyrinthNode(map, target.row, target.col)).toBe(true);
  });

  it("rejects later current nodes to avoid replaying an entered node", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const target = map.grid[0][2]!.connections[0];
    setCurrentNode(map, target.row, target.col);
    expect(canEnterLabyrinthNode(map, target.row, target.col)).toBe(false);
  });
});
