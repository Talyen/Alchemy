import { describe, expect, it } from "vitest";
import {
  canEnterLabyrinthNode,
  failNode,
  setCurrentNode,
  withCurrentNode,
  withFailedNode,
} from "@/lib/content-systems/labyrinth/map-state";
import { LABYRINTH_START_COL, LABYRINTH_START_ROW } from "@/lib/content-systems/labyrinth/data";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";

function makeNode(
  type: LabyrinthNode["type"],
  state: LabyrinthNode["state"],
  connections: LabyrinthNode["connections"] = [],
): LabyrinthNode {
  return { type, state, connections, modifiers: [], rewardModifiers: [] };
}

function makeMap(grid: (LabyrinthNode | null)[][], currentNode: { row: number; col: number }): LabyrinthMap {
  return { grid, rows: grid.length, cols: grid[0]?.length ?? 0, currentNode };
}

describe("canEnterLabyrinthNode", () => {
  it("returns true for a visible node connected to the current node", () => {
    const map = makeMap(
      [
        [makeNode("entrance", "current", [{ row: 1, col: 1 }]), null],
        [null, makeNode("combat", "visible", [{ row: 0, col: 0 }])],
      ],
      { row: 0, col: 0 },
    );
    expect(canEnterLabyrinthNode(map, 1, 1)).toBe(true);
  });

  it("returns false when the node is not connected to current", () => {
    const map = makeMap(
      [
        [makeNode("entrance", "current"), makeNode("combat", "visible")],
        [null, null],
      ],
      { row: 0, col: 0 },
    );
    expect(canEnterLabyrinthNode(map, 0, 1)).toBe(false);
  });

  it("returns false for hidden nodes", () => {
    const map = makeMap(
      [
        [makeNode("entrance", "current", [{ row: 1, col: 0 }]), null],
        [makeNode("combat", "hidden", [{ row: 0, col: 0 }]), null],
      ],
      { row: 0, col: 0 },
    );
    expect(canEnterLabyrinthNode(map, 1, 0)).toBe(false);
  });

  it("returns false for out-of-bounds coordinates", () => {
    const map = makeMap([[makeNode("entrance", "current")]], { row: 0, col: 0 });
    expect(canEnterLabyrinthNode(map, 2, 0)).toBe(false);
  });
});

describe("setCurrentNode", () => {
  it("clears the previous current node and marks the target as current", () => {
    const map = makeMap(
      [
        [makeNode("entrance", "current", [{ row: 1, col: 0 }]), null],
        [makeNode("combat", "visible", [{ row: 0, col: 0 }]), null],
      ],
      { row: 0, col: 0 },
    );
    setCurrentNode(map, 1, 0);
    expect(map.grid[0][0]?.state).toBe("cleared");
    expect(map.grid[1][0]?.state).toBe("current");
    expect(map.currentNode).toEqual({ row: 1, col: 0 });
  });
});

describe("withCurrentNode", () => {
  it("returns a new map without mutating the input", () => {
    const original = makeMap(
      [
        [makeNode("entrance", "current", [{ row: 1, col: 0 }]), null],
        [makeNode("combat", "visible", [{ row: 0, col: 0 }]), null],
      ],
      { row: 0, col: 0 },
    );
    const next = withCurrentNode(original, 1, 0);
    expect(original.grid[0][0]?.state).toBe("current");
    expect(next.grid[0][0]?.state).toBe("cleared");
    expect(next.grid[1][0]?.state).toBe("current");
    expect(next).not.toBe(original);
  });
});

describe("failNode", () => {
  it("marks the node failed and resets start to current", () => {
    const cols = 5;
    const row0 = Array.from({ length: cols }, (_, col) =>
      col === LABYRINTH_START_COL ? makeNode("entrance", "cleared") : null,
    );
    const row1 = Array.from({ length: cols }, () => null);
    row1[3] = makeNode("combat", "current");
    const map = makeMap([row0, row1], { row: 1, col: 3 });
    failNode(map, 1, 3);
    expect(map.grid[1][3]?.state).toBe("failed");
    expect(map.grid[LABYRINTH_START_ROW][LABYRINTH_START_COL]?.state).toBe("current");
    expect(map.currentNode).toEqual({ row: LABYRINTH_START_ROW, col: LABYRINTH_START_COL });
  });
});

describe("withFailedNode", () => {
  it("returns a cloned map with failNode semantics", () => {
    const cols = 5;
    const row0 = Array.from({ length: cols }, (_, col) =>
      col === LABYRINTH_START_COL ? makeNode("entrance", "cleared") : null,
    );
    const row1 = Array.from({ length: cols }, () => null);
    row1[3] = makeNode("elite", "current");
    const original = makeMap([row0, row1], { row: 1, col: 3 });
    const next = withFailedNode(original, { row: 1, col: 3 });
    expect(original.grid[1][3]?.state).toBe("current");
    expect(next.grid[1][3]?.state).toBe("failed");
    expect(next.grid[LABYRINTH_START_ROW][LABYRINTH_START_COL]?.state).toBe("current");
    expect(next).not.toBe(original);
  });
});
