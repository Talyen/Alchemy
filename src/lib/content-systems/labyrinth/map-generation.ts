// Procedural map generation for the Labyrinth.
// Produces a visible route-planning grid whose placed nodes form one connected route graph.
import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "../types";
import { LABYRINTH_COLS, LABYRINTH_ROWS } from "./data";
import { getEnemyModifiersForNodeType, getRewardModifiersForNodeType } from "./modifiers";

type Point = { row: number; col: number };
const MIN_BOSS_PATH_NODES = 11;

// Mulberry32 seeded PRNG — returns a function that produces deterministic
// values in [0, 1) for a given integer seed. Used by tests for reproducible maps.
export function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLabyrinthMap(rng: () => number = Math.random): LabyrinthMap {
  const grid: (LabyrinthNode | null)[][] = Array.from({ length: LABYRINTH_ROWS }, () =>
    Array.from({ length: LABYRINTH_COLS }, () => null),
  );
  const graph = generateRouteGraph(rng);
  const firstCombat = { row: 1, col: Math.floor(LABYRINTH_COLS / 2) };

  const upperPoints = graph.points.filter(
    (p) => !isStart(p) && !isBoss(p) && !samePoint(p, firstCombat) && p.row >= 1 && p.row <= 3,
  );
  const lowerPoints = graph.points.filter(
    (p) => !isStart(p) && !isBoss(p) && !samePoint(p, firstCombat) && p.row >= 4 && p.row <= 6,
  );

  const upperTypes = distributeNodeTypes(upperPoints.length, rng, 0.55, 0.2);
  const lowerTypes = distributeNodeTypes(lowerPoints.length, rng, 0.35, 0.3);

  graph.points.forEach((point) => {
    const type = isStart(point)
      ? "entrance"
      : isBoss(point)
        ? "boss"
        : samePoint(point, firstCombat)
          ? "combat"
          : point.row >= 1 && point.row <= 3
            ? upperTypes.shift()!
            : lowerTypes.shift()!;
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
  const start: Point = { row: 0, col: Math.floor(LABYRINTH_COLS / 2) };
  const points: Point[] = [];
  const edges: { from: Point; to: Point }[] = [];
  const used = new Set<string>();
  const degree = new Map<string, number>();
  const boss: Point = { row: LABYRINTH_ROWS - 1, col: start.col };
  const mainRoute = buildMainRoute(start, boss);

  addPath(points, edges, used, degree, mainRoute);

  const detours = [
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
  ];
  for (const detour of shuffleArray(detours, rng)) {
    if (detour.some((point) => !used.has(keyOf(point)) && !isInBounds(point))) continue;
    if (!canAddPath(detour, used, degree)) continue;
    addPath(points, edges, used, degree, detour);
  }

  if (shortestPathNodeCount(points, edges, start, boss) < MIN_BOSS_PATH_NODES) {
    throw new Error("Labyrinth route generation produced a boss shortcut");
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
  path: Point[],
) {
  for (const point of path) addPoint(points, used, point);
  for (let index = 0; index < path.length - 1; index += 1) {
    addEdge(edges, degree, path[index], path[index + 1]);
  }
}

function canAddPath(path: Point[], used: Set<string>, degree: Map<string, number>) {
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const fromExisting = used.has(keyOf(from));
    const toExisting = used.has(keyOf(to));
    const fromDegree = degree.get(keyOf(from)) ?? 0;
    const toDegree = degree.get(keyOf(to)) ?? 0;
    if (fromExisting && fromDegree >= 3) return false;
    if (toExisting && toDegree >= 3) return false;
  }
  return true;
}

function distributeNodeTypes(count: number, rng: () => number, combatPct = 0.45, elitePct = 0.25): LabyrinthNodeType[] {
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
    if (counts.combat > counts.elite && counts.combat > 1) counts.combat -= 1;
    else if (counts.elite > 1) counts.elite -= 1;
    else break;
    assigned -= 1;
  }

  const pool = Object.entries(counts).flatMap(([type, amount]) =>
    Array.from({ length: amount }, () => type as LabyrinthNodeType),
  );
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
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
  if ((degree.get(fromKey) ?? 0) >= 3 || (degree.get(toKey) ?? 0) >= 3) return;
  edges.push({ from, to });
  degree.set(fromKey, (degree.get(fromKey) ?? 0) + 1);
  degree.set(toKey, (degree.get(toKey) ?? 0) + 1);
}

function shuffleArray<T>(items: T[], rng: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function isStart(point: Point) {
  return point.row === 0 && point.col === Math.floor(LABYRINTH_COLS / 2);
}

function isBoss(point: Point) {
  return point.row === LABYRINTH_ROWS - 1 && point.col === Math.floor(LABYRINTH_COLS / 2);
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

export function revealConnected(_map: LabyrinthMap): void {
  // Labyrinth maps are fully visible from the start for route planning.
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
export function withCurrentNode(map: LabyrinthMap, row: number, col: number): LabyrinthMap {
  const grid = map.grid.map((r) => r.map((n) => (n ? { ...n } : n)));
  const next: LabyrinthMap = { ...map, grid };
  setCurrentNode(next, row, col);
  return next;
}

export function failNode(map: LabyrinthMap, row: number, col: number): void {
  const node = map.grid[row]?.[col];
  if (node && node.state === "current") {
    node.state = "failed";
  }
  const start = map.grid[0]?.[Math.floor(LABYRINTH_COLS / 2)];
  if (start && start.state !== "failed") {
    start.state = "current";
    map.currentNode = { row: 0, col: Math.floor(LABYRINTH_COLS / 2) };
  }
}
