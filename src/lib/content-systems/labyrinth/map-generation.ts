// Procedural map generation for the Labyrinth.
// Produces a 5x5 grid with cardinal-direction connections.
// Row 0 has a single start node; rows below branch out.
import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "../types";
import { getModifiersForRow } from "./modifiers";

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

const ROWS = 5;
const COLS = 5;

// Weight table for random node type selection.
const NODE_TYPE_WEIGHTS: { type: LabyrinthNodeType; weight: number }[] = [
  { type: "combat", weight: 40 },
  { type: "elite", weight: 10 },
  { type: "treasure", weight: 12 },
  { type: "rest", weight: 12 },
  { type: "mystery", weight: 10 },
  { type: "shop", weight: 8 },
  { type: "alchemist", weight: 8 },
];

// Node density per row (chance each cell gets a node).
// Row 1 is sparse, rows 2-3 denser, row 4 moderate.
const NODE_DENSITY = [0, 0.45, 0.55, 0.55, 0.4];

// Guaranteed center-column nodes form a stable critical path from start to boss;
// random side nodes add variety without risking disconnected maps.
const GUARANTEED_COLUMNS: Record<number, number[]> = {
  1: [2],
  2: [1, 2, 3],
  3: [2],
  4: [2],
};

export function generateLabyrinthMap(rng: () => number = Math.random): LabyrinthMap {
  const grid: (LabyrinthNode | null)[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null),
  );

  // Row 0: single start combat node at center.
  grid[0][2] = makeNode("combat", 0, rng);
  grid[0][2]!.state = "current";

  // Place nodes in rows 1-4.
  for (let row = 1; row < ROWS; row++) {
    // Place guaranteed columns first.
    const guaranteed = GUARANTEED_COLUMNS[row] ?? [];
    for (const col of guaranteed) {
      if (!grid[row][col]) {
        grid[row][col] = makeNode(randomNodeType(rng), row, rng);
      }
    }

    // Randomly fill remaining cells.
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col]) continue;
      if (rng() < NODE_DENSITY[row]) {
        grid[row][col] = makeNode(randomNodeType(rng), row, rng);
      }
    }

    // If the row ended up empty, force a node at a connected position.
    if (isEmptyRow(grid, row)) {
      const fallbackCol = findBestConnectedColumn(grid, row);
      grid[row][fallbackCol] = makeNode(randomNodeType(rng), row, rng);
    }
  }

  // Ensure at least one boss node in row 4.
  ensureBossNode(grid, rng);

  // Assign cardinal-direction connections between placed nodes.
  assignConnections(grid);

  // Set the starting position.
  const map: LabyrinthMap = {
    grid,
    rows: ROWS,
    cols: COLS,
    currentNode: { row: 0, col: 2 },
  };

  // Reveal start node's connections.
  revealConnected(map);

  return map;
}

function makeNode(type: LabyrinthNodeType, row: number, rng: () => number = Math.random): LabyrinthNode {
  return {
    type,
    modifiers: type === "combat" || type === "elite" || type === "boss" ? getModifiersForRow(row, rng) : [],
    connections: [],
    state: "hidden",
  };
}

function randomNodeType(rng: () => number = Math.random): LabyrinthNodeType {
  const totalWeight = NODE_TYPE_WEIGHTS.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of NODE_TYPE_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return "combat";
}

function isEmptyRow(grid: (LabyrinthNode | null)[][], row: number): boolean {
  return grid[row].every((n) => n === null);
}

function findBestConnectedColumn(grid: (LabyrinthNode | null)[][], row: number): number {
  // Prefer columns that have a node directly above (cardinal down from previous row).
  for (let col = 0; col < COLS; col++) {
    if (grid[row - 1]?.[col]) return col;
  }
  // Fallback: center.
  return 2;
}

function ensureBossNode(grid: (LabyrinthNode | null)[][], rng: () => number = Math.random): void {
  const bossRow = ROWS - 1;

  // The center boss is the guaranteed endpoint of the critical path.
  if (grid[bossRow - 1]?.[2]) {
    grid[bossRow][2] = makeNode("boss", bossRow, rng);
    return;
  }

  // Find a column with a node above it to ensure connectivity.
  for (let col = 0; col < COLS; col++) {
    if (grid[bossRow - 1]?.[col]) {
      grid[bossRow][col] = makeNode("boss", bossRow, rng);
      return;
    }
  }

  // Force boss at center if no column has an above connection.
  grid[bossRow][2] = makeNode("boss", bossRow, rng);
}

function assignConnections(grid: (LabyrinthNode | null)[][]): void {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const node = grid[row][col];
      if (!node) continue;

      const connections: { row: number; col: number }[] = [];

      // Down: (row+1, col).
      if (row + 1 < ROWS && grid[row + 1][col]) {
        connections.push({ row: row + 1, col });
      }

      // Left: (row, col-1) — horizontal within same row.
      if (col - 1 >= 0 && grid[row][col - 1]) {
        connections.push({ row, col: col - 1 });
      }

      // Right: (row, col+1) — horizontal within same row.
      if (col + 1 < COLS && grid[row][col + 1]) {
        connections.push({ row, col: col + 1 });
      }

      node.connections = connections;
    }
  }
}

export function revealConnected(map: LabyrinthMap): void {
  const { row, col } = map.currentNode;
  const node = map.grid[row]?.[col];
  if (!node) return;

  for (const conn of node.connections) {
    const neighbor = map.grid[conn.row]?.[conn.col];
    if (neighbor && neighbor.state === "hidden") {
      neighbor.state = "visible";
    }
  }
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
    revealConnected(map);
  }
}

// Immutable variant of setCurrentNode — returns a new map instead of mutating.
// Used by React state to avoid in-place mutation inside setState callbacks.
export function withCurrentNode(map: LabyrinthMap, row: number, col: number): LabyrinthMap {
  // Deep-clone the grid so mutation doesn't touch the original.
  const grid = map.grid.map((r) => r.map((n) => (n ? { ...n, connections: [...n.connections] } : n)));
  const next: LabyrinthMap = { ...map, grid };
  setCurrentNode(next, row, col);
  return next;
}

export function failNode(map: LabyrinthMap, row: number, col: number): void {
  const node = map.grid[row]?.[col];
  if (node && node.state === "current") {
    node.state = "failed";
    // Return to previous position — the start node, since you can always retry from there.
    map.currentNode = { row: 0, col: 2 };
  }
}
