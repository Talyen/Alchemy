/**
 * Labyrinth route graph: path placement, edges, and shortest-path validation.
 */
import { shuffle as shuffleWithRng } from "@/lib/utils";

import type { LabyrinthNode } from "../types";
import {
  LABYRINTH_BOSS_ROW,
  LABYRINTH_COLS,
  LABYRINTH_MAP_CONFIG,
  LABYRINTH_ROWS,
  LABYRINTH_START_COL,
  LABYRINTH_START_ROW,
  type LabyrinthPoint,
} from "./data";

type Point = LabyrinthPoint;

function isInBounds(point: Point) {
  return point.row >= 0 && point.row < LABYRINTH_ROWS && point.col >= 0 && point.col < LABYRINTH_COLS;
}

function validateDetourPaths(): void {
  for (const [pathIndex, path] of LABYRINTH_MAP_CONFIG.detourPaths.entries()) {
    for (const point of path) {
      if (!isInBounds(point)) {
        throw new RangeError(
          `Detour path ${pathIndex}: point (${point.row}, ${point.col}) out of bounds for grid ${LABYRINTH_ROWS}x${LABYRINTH_COLS}`,
        );
      }
    }
  }
}
validateDetourPaths();

export function isStart(point: Point) {
  return point.row === LABYRINTH_START_ROW && point.col === LABYRINTH_START_COL;
}

export function isBoss(point: Point) {
  return point.row === LABYRINTH_BOSS_ROW && point.col === LABYRINTH_START_COL;
}

export function samePoint(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

export function isInRowBand(point: Point, band: Readonly<{ min: number; max: number }>) {
  return point.row >= band.min && point.row <= band.max;
}

export function generateRouteGraph(rng: () => number): { points: Point[]; edges: { from: Point; to: Point }[] } {
  const start: Point = { row: LABYRINTH_START_ROW, col: LABYRINTH_START_COL };
  const points: Point[] = [];
  const edges: { from: Point; to: Point }[] = [];
  const used = new Set<string>();
  const degree = new Map<string, number>();
  const boss: Point = { row: LABYRINTH_BOSS_ROW, col: start.col };
  const mainRoute = buildMainRoute(start, boss);

  addPath(points, edges, used, degree, mainRoute);

  for (const detour of shuffleWithRng(LABYRINTH_MAP_CONFIG.detourPaths, rng)) {
    if (detour.some((point) => !isInBounds(point))) continue;
    if (!canAddPath(detour, used, degree)) continue;
    addPath(points, edges, used, degree, detour);
  }

  if (shortestPathNodeCount(points, edges, start, boss) < LABYRINTH_MAP_CONFIG.minBossPathNodes) {
    throw new Error("Boss shortcut detected");
  }
  return { points, edges };
}

function buildMainRoute(start: Point, boss: Point): Point[] {
  return [
    start,
    { row: 1, col: start.col },
    { row: 1, col: start.col - 1 },
    { row: 2, col: start.col - 1 },
    { row: 2, col: start.col },
    { row: 3, col: start.col },
    { row: 3, col: start.col + 1 },
    { row: 4, col: start.col + 1 },
    { row: 4, col: start.col },
    { row: 5, col: start.col },
    { row: 5, col: start.col - 1 },
    { row: 6, col: start.col - 1 },
    { row: 6, col: start.col },
    boss,
  ];
}

function addPath(
  points: Point[],
  edges: { from: Point; to: Point }[],
  used: Set<string>,
  degree: Map<string, number>,
  path: readonly Point[],
) {
  for (const point of path) addPoint(points, used, point);
  for (let index = 0; index < path.length - 1; index += 1) {
    addEdge(edges, degree, path[index]!, path[index + 1]!);
  }
}

function canAddPath(path: readonly Point[], used: Set<string>, degree: Map<string, number>) {
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index]!;
    const to = path[index + 1]!;
    const fromExisting = used.has(keyOf(from));
    const toExisting = used.has(keyOf(to));
    const fromDegree = degree.get(keyOf(from)) ?? 0;
    const toDegree = degree.get(keyOf(to)) ?? 0;
    if (fromExisting && fromDegree >= LABYRINTH_MAP_CONFIG.maxNodeDegree) return false;
    if (toExisting && toDegree >= LABYRINTH_MAP_CONFIG.maxNodeDegree) return false;
  }
  return true;
}

function addPoint(path: Point[], used: Set<string>, point: Point) {
  if (used.has(keyOf(point))) return;
  path.push(point);
  used.add(keyOf(point));
}

export function connect(grid: (LabyrinthNode | null)[][], a: Point, b: Point) {
  const nodeA = grid[a.row]?.[a.col];
  const nodeB = grid[b.row]?.[b.col];
  if (!nodeA || !nodeB) return;
  nodeA.connections.push({ row: b.row, col: b.col });
  nodeB.connections.push({ row: a.row, col: a.col });
}

function addEdge(edges: { from: Point; to: Point }[], degree: Map<string, number>, from: Point, to: Point) {
  const fromKey = keyOf(from);
  const toKey = keyOf(to);
  if (
    (degree.get(fromKey) ?? 0) >= LABYRINTH_MAP_CONFIG.maxNodeDegree ||
    (degree.get(toKey) ?? 0) >= LABYRINTH_MAP_CONFIG.maxNodeDegree
  ) {
    return;
  }
  edges.push({ from, to });
  degree.set(fromKey, (degree.get(fromKey) ?? 0) + 1);
  degree.set(toKey, (degree.get(toKey) ?? 0) + 1);
}

function shortestPathNodeCount(points: Point[], edges: { from: Point; to: Point }[], start: Point, boss: Point) {
  const adjacency = new Map<string, string[]>();
  for (const point of points) adjacency.set(keyOf(point), []);
  for (const edge of edges) {
    const fromKey = keyOf(edge.from);
    const toKey = keyOf(edge.to);
    adjacency.get(fromKey)?.push(toKey);
    adjacency.get(toKey)?.push(fromKey);
  }

  const bossKey = keyOf(boss);
  const visited = new Set<string>();
  const queue = [{ key: keyOf(start), count: 1 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.key)) continue;
    if (current.key === bossKey) return current.count;
    visited.add(current.key);
    for (const next of adjacency.get(current.key) ?? []) {
      queue.push({ key: next, count: current.count + 1 });
    }
  }
  return 0;
}

function keyOf(point: Point) {
  return `${point.row},${point.col}`;
}
