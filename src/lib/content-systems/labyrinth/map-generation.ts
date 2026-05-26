/**
 * Procedural map generator for Labyrinth mode using a seeded PRNG.
 * Handles grid coordinate generation, node connectivity, traversal checks, and state transitions.
 * Depends on: data.ts, modifiers.ts, src/lib/content-systems/types.ts
 * Depended on by: use-labyrinth-controller.ts, screen-store.ts, tests
 */

import { createSeededRng, shuffle as shuffleWithRng } from "@/lib/utils";
/**
 * @deprecated Import createSeededRng and shuffleWithRng directly from "@/lib/utils" instead.
 * These re-exports exist only for backward compatibility with existing test/module imports.
 */
export { createSeededRng, shuffleWithRng };

import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "../types";
import { LABYRINTH_COLS, LABYRINTH_ROWS } from "./data";
import { getEnemyModifiersForNodeType, getRewardModifiersForNodeType } from "./modifiers";
import { logError } from "../../error-logger";

type Point = { row: number; col: number };

// Shared game design constants and grid geometry tokens
const CONSTANTS = {
  startCol: Math.floor(LABYRINTH_COLS / 2),
  startRow: 0,
  bossRow: LABYRINTH_ROWS - 1,
} as const;

const LABYRINTH_MAP_CONFIG = {
  minBossPathNodes: 11,
  maxNodeDegree: 3,
  upperRowBand: { min: 1, max: 3, combatPct: 0.55, elitePct: 0.2 },
  lowerRowBand: { min: 4, max: 6, combatPct: 0.35, elitePct: 0.3 },
  detourPaths: [
    [
      { row: 1, col: 3 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
    ],
    [
      { row: 1, col: 2 },
      { row: 1, col: 1 },
      { row: 2, col: 1 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 2, col: 2 },
    ],
    [
      { row: 2, col: 4 },
      { row: 2, col: 5 },
      { row: 2, col: 6 },
      { row: 3, col: 6 },
      { row: 3, col: 5 },
    ],
    [
      { row: 2, col: 6 },
      { row: 2, col: 7 },
      { row: 3, col: 7 },
      { row: 4, col: 7 },
      { row: 4, col: 6 },
      { row: 3, col: 6 },
    ],
    [
      { row: 4, col: 5 },
      { row: 4, col: 6 },
      { row: 5, col: 6 },
      { row: 5, col: 5 },
      { row: 5, col: 4 },
    ],
    [
      { row: 5, col: 6 },
      { row: 5, col: 7 },
      { row: 6, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 5 },
      { row: 6, col: 4 },
    ],
    [
      { row: 5, col: 3 },
      { row: 5, col: 2 },
      { row: 6, col: 2 },
      { row: 6, col: 3 },
    ],
    [
      { row: 5, col: 2 },
      { row: 5, col: 1 },
      { row: 6, col: 1 },
      { row: 6, col: 2 },
    ],
  ],
} as const;

// Validates every detour path coordinate is within grid bounds.
// Fails early at module load so misconfigured dimensions are caught immediately.
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

function isInRowBand(point: Point, band: Readonly<{ min: number; max: number }>) {
  return point.row >= band.min && point.row <= band.max;
}

function initializeEmptyGrid(): (LabyrinthNode | null)[][] {
  return Array.from({ length: LABYRINTH_ROWS }, () => Array.from({ length: LABYRINTH_COLS }, () => null));
}

function filterPointsForBand(
  points: Point[],
  band: Readonly<{ min: number; max: number }>,
  firstCombat: Point,
): Point[] {
  return points.filter((p) => !isStart(p) && !isBoss(p) && !samePoint(p, firstCombat) && isInRowBand(p, band));
}

function determineNodeType(
  point: Point,
  firstCombat: Point,
  upperTypes: LabyrinthNodeType[],
  lowerTypes: LabyrinthNodeType[],
): LabyrinthNodeType {
  if (isStart(point)) return "entrance";
  if (isBoss(point)) return "boss";
  if (samePoint(point, firstCombat)) return "combat";

  const { upperRowBand } = LABYRINTH_MAP_CONFIG;
  if (isInRowBand(point, upperRowBand)) {
    return upperTypes.shift()!;
  }
  return lowerTypes.shift()!;
}

/**
 * Procedural generation entrypoint. Creates a fully connected graph representing the Labyrinth.
 * Coordinates are mapped to an 8x9 grid: row index [0..7] represents depth (0 is start, 7 is boss),
 * and col index [0..8] represents horizontal paths (4 is the center column).
 */
export function generateLabyrinthMap(rng: () => number = Math.random): LabyrinthMap {
  const grid = initializeEmptyGrid();
  let graph;
  try {
    graph = generateRouteGraph(rng);
  } catch (cause) {
    console.warn("[Labyrinth] Seeded map generation failed, retrying with Math.random:", cause);
    try {
      graph = generateRouteGraph(() => Math.random());
    } catch (fallbackCause) {
      logError("[Labyrinth] Map generation failed even with Math.random fallback", "validation", {
        error: String(fallbackCause),
      });
      throw Object.assign(new Error("Labyrinth map generation failed after retry"), { rootCause: fallbackCause });
    }
  }
  const firstCombat = { row: 1, col: CONSTANTS.startCol };
  const { upperRowBand, lowerRowBand } = LABYRINTH_MAP_CONFIG;

  const upperPoints = filterPointsForBand(graph.points, upperRowBand, firstCombat);
  const lowerPoints = filterPointsForBand(graph.points, lowerRowBand, firstCombat);

  const upperTypes = distributeNodeTypes(upperPoints.length, rng, upperRowBand.combatPct, upperRowBand.elitePct);
  const lowerTypes = distributeNodeTypes(lowerPoints.length, rng, lowerRowBand.combatPct, lowerRowBand.elitePct);

  graph.points.forEach((point) => {
    const type = determineNodeType(point, firstCombat, upperTypes, lowerTypes);
    grid[point.row][point.col] = makeNode(type, rng, isStart(point) ? "current" : "visible");
  });

  for (const edge of graph.edges) {
    connect(grid, edge.from, edge.to);
  }

  return {
    grid,
    rows: LABYRINTH_ROWS,
    cols: LABYRINTH_COLS,
    currentNode: graph.points[0],
  };
}

function generateRouteGraph(rng: () => number): { points: Point[]; edges: { from: Point; to: Point }[] } {
  const start: Point = { row: CONSTANTS.startRow, col: CONSTANTS.startCol };
  const points: Point[] = [];
  const edges: { from: Point; to: Point }[] = [];
  const used = new Set<string>();
  const degree = new Map<string, number>();
  const boss: Point = { row: CONSTANTS.bossRow, col: start.col };
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
    addEdge(edges, degree, path[index], path[index + 1]);
  }
}

function canAddPath(path: readonly Point[], used: Set<string>, degree: Map<string, number>) {
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const fromExisting = used.has(keyOf(from));
    const toExisting = used.has(keyOf(to));
    const fromDegree = degree.get(keyOf(from)) ?? 0;
    const toDegree = degree.get(keyOf(to)) ?? 0;
    if (fromExisting && fromDegree >= LABYRINTH_MAP_CONFIG.maxNodeDegree) return false;
    if (toExisting && toDegree >= LABYRINTH_MAP_CONFIG.maxNodeDegree) return false;
  }
  return true;
}

function calculateNodeTypeCounts(
  count: number,
  rng: () => number,
  combatPct: number,
  elitePct: number,
): Record<Exclude<LabyrinthNodeType, "entrance" | "boss">, number> {
  const counts: Record<Exclude<LabyrinthNodeType, "entrance" | "boss">, number> = {
    combat: Math.max(1, Math.round(count * combatPct)),
    elite: Math.max(1, Math.round(count * elitePct)),
    rest: 0,
    mystery: 0,
    shop: 0,
    alchemist: 0,
  };
  const supportTypes: Array<Exclude<LabyrinthNodeType, "entrance" | "combat" | "elite" | "boss">> = [
    "rest",
    "mystery",
    "shop",
    "alchemist",
  ];
  let assigned = counts.combat + counts.elite;
  let supportIndex = Math.floor(rng() * supportTypes.length);

  while (assigned < count) {
    counts[supportTypes[supportIndex % supportTypes.length]] += 1;
    supportIndex += 1;
    assigned += 1;
  }
  while (assigned > count) {
    if (counts.combat > counts.elite && counts.combat > 1) {
      counts.combat -= 1;
    } else if (counts.elite > 1) {
      counts.elite -= 1;
    } else {
      break;
    }
    assigned -= 1;
  }
  return counts;
}

function distributeNodeTypes(count: number, rng: () => number, combatPct = 0.45, elitePct = 0.25): LabyrinthNodeType[] {
  const counts = calculateNodeTypeCounts(count, rng, combatPct, elitePct);
  const pool = Object.entries(counts).flatMap(([type, amount]) =>
    Array.from({ length: amount }, () => type as LabyrinthNodeType),
  );
  return shuffleWithRng(pool, rng);
}

function makeNode(type: LabyrinthNodeType, rng: () => number, state: LabyrinthNode["state"]): LabyrinthNode {
  return {
    type,
    modifiers: type === "combat" || type === "elite" || type === "boss" ? getEnemyModifiersForNodeType(type, rng) : [],
    rewardModifiers:
      type === "combat" || type === "elite" || type === "boss" ? getRewardModifiersForNodeType(type, rng) : [],
    connections: [],
    state,
  };
}

function addPoint(path: Point[], used: Set<string>, point: Point) {
  if (used.has(keyOf(point))) return;
  path.push(point);
  used.add(keyOf(point));
}

function connect(grid: (LabyrinthNode | null)[][], a: Point, b: Point) {
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

function isStart(point: Point) {
  return point.row === CONSTANTS.startRow && point.col === CONSTANTS.startCol;
}

function isBoss(point: Point) {
  return point.row === CONSTANTS.bossRow && point.col === CONSTANTS.startCol;
}

function samePoint(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

function isInBounds(point: Point) {
  return point.row >= 0 && point.row < LABYRINTH_ROWS && point.col >= 0 && point.col < LABYRINTH_COLS;
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

/**
 * Determines whether a node can be entered from the current node.
 * Connection must exist, and the target node must be in a 'visible' state.
 */
export function canEnterLabyrinthNode(map: LabyrinthMap, row: number, col: number): boolean {
  const node = map.grid[row]?.[col];
  if (!node) return false;
  const current = map.grid[map.currentNode.row]?.[map.currentNode.col];
  const connectedToCurrent = Boolean(
    current?.connections.some((connection) => connection.row === row && connection.col === col),
  );
  return node.state === "visible" && connectedToCurrent;
}

export function setCurrentNode(map: LabyrinthMap, row: number, col: number): void {
  const prev = map.grid[map.currentNode.row]?.[map.currentNode.col];
  if (prev && prev.state === "current") {
    prev.state = "cleared";
  }

  const node = map.grid[row]?.[col];
  if (node) {
    node.state = "current";
    map.currentNode = { row, col };
  }
}

// Immutable variant of setCurrentNode — returns a new map instead of mutating.
// Used by React state to avoid in-place mutation inside setState callbacks.
// Prefer this over setCurrentNode in application code.
export function withCurrentNode(map: LabyrinthMap, row: number, col: number): LabyrinthMap {
  const grid = map.grid.map((r) => r.map((n) => (n ? { ...n } : n)));
  const next: LabyrinthMap = { ...map, grid };
  setCurrentNode(next, row, col);
  return next;
}

/**
 * Mutates `map` in-place — marks the node at (row, col) as "failed"
 * and resets current position to the start node.
 * @internal Prefer the immutable wrapper `withFailedNode()` in application code.
 */
export function failNode(map: LabyrinthMap, row: number, col: number): void {
  for (const r of map.grid) {
    for (const node of r) {
      if (node?.state === "current") {
        node.state = "cleared";
      }
    }
  }
  const node = map.grid[row]?.[col];
  if (node) {
    node.state = "failed";
  }
  const startCol = CONSTANTS.startCol;
  const start = map.grid[CONSTANTS.startRow]?.[startCol];
  if (start && start.state !== "failed") {
    start.state = "current";
    map.currentNode = { row: CONSTANTS.startRow, col: startCol };
  }
}

// Immutable variant of failNode — calls failNode on a deep-cloned copy.
export function withFailedNode(map: LabyrinthMap, pending: { row: number; col: number }): LabyrinthMap {
  const grid = map.grid.map((r) => r.map((n) => (n ? { ...n, connections: [...n.connections] } : n)));
  const next: LabyrinthMap = { ...map, grid };
  failNode(next, pending.row, pending.col);
  return next;
}
