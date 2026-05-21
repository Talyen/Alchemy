// Unit tests for Labyrinth controller traversal guards.
// Depends on generated maps and the pure node-entry predicate exported by the hook module.
import { describe, expect, it } from "vitest";

import { LABYRINTH_COLS } from "@/lib/content-systems/labyrinth/data";
import {
  createSeededRng,
  generateLabyrinthMap,
  setCurrentNode,
  canEnterLabyrinthNode,
  withFailedNode as failPendingLabyrinthNode,
} from "@/lib/content-systems/labyrinth/map-generation";

const START_COL = Math.floor(LABYRINTH_COLS / 2);

describe("canEnterLabyrinthNode", () => {
  it("rejects the opening entrance because it is the origin, not a chosen node", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    expect(map.grid[0][START_COL]!.type).toBe("entrance");
    expect(canEnterLabyrinthNode(map, 0, START_COL)).toBe(false);
  });

  it("allows visible connected nodes", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const target = map.grid[0][START_COL]!.connections[0];
    expect(canEnterLabyrinthNode(map, target.row, target.col)).toBe(true);
  });

  it("rejects visible nodes that are not connected to the current node", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const unconnected = map.grid.flatMap((row, rowIndex) => row.map((node, colIndex) => ({ node, row: rowIndex, col: colIndex })))
      .find(({ node, row, col }) => node?.state === "visible" && !map.grid[0][START_COL]!.connections.some((connection) => connection.row === row && connection.col === col));
    expect(unconnected).toBeDefined();
    expect(canEnterLabyrinthNode(map, unconnected!.row, unconnected!.col)).toBe(false);
  });

  it("rejects later current nodes to avoid replaying an entered node", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const target = map.grid[0][START_COL]!.connections[0];
    setCurrentNode(map, target.row, target.col);
    expect(canEnterLabyrinthNode(map, target.row, target.col)).toBe(false);
  });

  it("maintains exactly one current node through multi-step traversal", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const countCurrent = (m: typeof map) => m.grid.flat().filter((n) => n?.state === "current").length;
    expect(countCurrent(map)).toBe(1);

    let pos = { row: 0, col: START_COL };
    for (let step = 0; step < 5; step++) {
      const node = map.grid[pos.row]?.[pos.col];
      if (!node || node.connections.length === 0) break;
      const next = node.connections[0];
      setCurrentNode(map, next.row, next.col);
      expect(countCurrent(map)).toBe(1);
      expect(map.currentNode).toEqual({ row: next.row, col: next.col });
      pos = next;
    }
  });
});

describe("failPendingLabyrinthNode", () => {
  it("marks the pending node failed and leaves only the entrance current", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const first = map.grid[0][START_COL]!.connections[0];
    setCurrentNode(map, first.row, first.col);
    const second = map.grid[first.row][first.col]!.connections.find((connection) => connection.row !== 0);
    expect(second).toBeDefined();

    const next = failPendingLabyrinthNode(map, second!);
    const currentNodes = next.grid.flat().filter((node) => node?.state === "current");

    expect(next.grid[second!.row][second!.col]!.state).toBe("failed");
    expect(next.currentNode).toEqual({ row: 0, col: START_COL });
    expect(currentNodes).toHaveLength(1);
    expect(next.grid[0][START_COL]!.state).toBe("current");
  });
});
