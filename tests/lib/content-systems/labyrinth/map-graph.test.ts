import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/lib/utils";
import {
  LABYRINTH_BOSS_ROW,
  LABYRINTH_COLS,
  LABYRINTH_ROWS,
  LABYRINTH_START_COL,
  LABYRINTH_START_ROW,
} from "@/lib/content-systems/labyrinth/data";
import {
  connect,
  generateRouteGraph,
  isBoss,
  isInRowBand,
  isStart,
  samePoint,
} from "@/lib/content-systems/labyrinth/map-graph";
import type { LabyrinthNode } from "@/lib/content-systems/types";

function pointKey(point: { row: number; col: number }) {
  return `${point.row},${point.col}`;
}

function bossReachable(
  points: { row: number; col: number }[],
  edges: { from: { row: number; col: number }; to: { row: number; col: number } }[],
) {
  const start = { row: LABYRINTH_START_ROW, col: LABYRINTH_START_COL };
  const boss = { row: LABYRINTH_BOSS_ROW, col: LABYRINTH_START_COL };
  const adjacency = new Map<string, string[]>();
  for (const point of points) adjacency.set(pointKey(point), []);
  for (const edge of edges) {
    adjacency.get(pointKey(edge.from))?.push(pointKey(edge.to));
    adjacency.get(pointKey(edge.to))?.push(pointKey(edge.from));
  }
  const visited = new Set<string>();
  const queue = [pointKey(start)];
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (key === pointKey(boss)) return true;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const next of adjacency.get(key) ?? []) queue.push(next);
  }
  return false;
}

function makeNode(type: LabyrinthNode["type"] = "combat"): LabyrinthNode {
  return { type, modifiers: [], rewardModifiers: [], connections: [], state: "visible" };
}

describe("map-graph predicates", () => {
  it("isStart matches the configured entrance cell", () => {
    expect(isStart({ row: LABYRINTH_START_ROW, col: LABYRINTH_START_COL })).toBe(true);
    expect(isStart({ row: LABYRINTH_START_ROW, col: LABYRINTH_START_COL + 1 })).toBe(false);
  });

  it("isBoss matches the configured boss cell", () => {
    expect(isBoss({ row: LABYRINTH_BOSS_ROW, col: LABYRINTH_START_COL })).toBe(true);
    expect(isBoss({ row: LABYRINTH_BOSS_ROW, col: LABYRINTH_START_COL + 1 })).toBe(false);
  });

  it("samePoint compares row and col", () => {
    const a = { row: 2, col: 3 };
    expect(samePoint(a, { ...a })).toBe(true);
    expect(samePoint(a, { row: 2, col: 4 })).toBe(false);
  });

  it("isInRowBand is inclusive on min and max", () => {
    const band = { min: 2, max: 4 };
    expect(isInRowBand({ row: 2, col: 0 }, band)).toBe(true);
    expect(isInRowBand({ row: 4, col: 0 }, band)).toBe(true);
    expect(isInRowBand({ row: 1, col: 0 }, band)).toBe(false);
    expect(isInRowBand({ row: 5, col: 0 }, band)).toBe(false);
  });
});

describe("generateRouteGraph", () => {
  const rng = createSeededRng(42);

  it("is deterministic for the same RNG", () => {
    const first = generateRouteGraph(createSeededRng(7));
    const second = generateRouteGraph(createSeededRng(7));
    expect(first.points.length).toBe(second.points.length);
    expect(first.edges.length).toBe(second.edges.length);
    expect(first.points.map(pointKey)).toEqual(second.points.map(pointKey));
  });

  it("places every edge endpoint in bounds and includes the start", () => {
    const graph = generateRouteGraph(rng);
    expect(graph.points.some((point) => isStart(point))).toBe(true);
    for (const edge of graph.edges) {
      for (const point of [edge.from, edge.to]) {
        expect(point.row).toBeGreaterThanOrEqual(0);
        expect(point.row).toBeLessThan(LABYRINTH_ROWS);
        expect(point.col).toBeGreaterThanOrEqual(0);
        expect(point.col).toBeLessThan(LABYRINTH_COLS);
      }
    }
  });

  it("connects the start to the boss", () => {
    const graph = generateRouteGraph(rng);
    expect(bossReachable(graph.points, graph.edges)).toBe(true);
  });
});

describe("connect", () => {
  it("adds bidirectional connections between populated nodes", () => {
    const grid: (LabyrinthNode | null)[][] = Array.from({ length: LABYRINTH_ROWS }, () =>
      Array.from({ length: LABYRINTH_COLS }, () => null),
    );
    grid[0][LABYRINTH_START_COL] = makeNode("entrance");
    grid[1][LABYRINTH_START_COL] = makeNode("combat");

    connect(grid, { row: 0, col: LABYRINTH_START_COL }, { row: 1, col: LABYRINTH_START_COL });

    expect(grid[0][LABYRINTH_START_COL]!.connections).toContainEqual({ row: 1, col: LABYRINTH_START_COL });
    expect(grid[1][LABYRINTH_START_COL]!.connections).toContainEqual({ row: 0, col: LABYRINTH_START_COL });
  });

  it("no-ops when either endpoint is missing", () => {
    const grid: (LabyrinthNode | null)[][] = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => null));
    grid[0][0] = makeNode("entrance");
    connect(grid, { row: 0, col: 0 }, { row: 1, col: 1 });
    expect(grid[0][0]!.connections).toEqual([]);
  });

  it("does not duplicate the same directed connection", () => {
    const grid: (LabyrinthNode | null)[][] = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => null));
    grid[0][0] = makeNode("entrance");
    grid[1][1] = makeNode("combat");
    connect(grid, { row: 0, col: 0 }, { row: 1, col: 1 });
    connect(grid, { row: 0, col: 0 }, { row: 1, col: 1 });
    expect(grid[0][0]!.connections.filter((c) => c.row === 1 && c.col === 1)).toHaveLength(2);
  });
});
