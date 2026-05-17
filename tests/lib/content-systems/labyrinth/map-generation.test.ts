// Unit tests for labyrinth map generation — grid invariants, cardinal connections,
// node placement, visibility, and state transitions.
import { describe, expect, it } from "vitest";
import {
  createSeededRng,
  generateLabyrinthMap,
  failNode,
  revealConnected,
  setCurrentNode,
} from "@/lib/content-systems/labyrinth/map-generation";

const ROWS = 8;
const COLS = 9;
const START_COL = Math.floor(COLS / 2);

describe("generateLabyrinthMap", () => {
  it("generates an 8x9 grid", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    expect(map.grid).toHaveLength(ROWS);
    for (const row of map.grid) {
      expect(row).toHaveLength(COLS);
    }
  });

  it("start node is at the top center, entrance type, current state", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const start = map.grid[0][START_COL];
    expect(start).not.toBeNull();
    expect(start!.type).toBe("entrance");
    expect(start!.state).toBe("current");
    // All other row-0 cells must be empty.
    for (let c = 0; c < COLS; c++) {
      if (c !== START_COL) expect(map.grid[0][c]).toBeNull();
    }
  });

  it("first node after the entrance is always normal combat", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const map = generateLabyrinthMap(createSeededRng(seed));
      expect(map.grid[1][START_COL]?.type).toBe("combat");
    }
  });

  it("fills substantially more of the map", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const placedNodes = map.grid.flat().filter(Boolean).length;
    expect(placedNodes).toBeGreaterThanOrEqual(36);
  });

  it("requires more than 10 nodes to reach the boss by the shortest path", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const map = generateLabyrinthMap(createSeededRng(seed));
      expect(shortestBossPathNodeCount(map)).toBeGreaterThan(10);
    }
  });

  it("all connections are cardinal-direction only", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const node = map.grid[r][c];
        if (!node) continue;
        for (const conn of node.connections) {
          const dr = Math.abs(conn.row - r);
          const dc = Math.abs(conn.col - c);
          // Must be exactly one step in one direction, never diagonal.
          expect((dr === 1 && dc === 0) || (dr === 0 && dc === 1)).toBe(true);
        }
      }
    }
  });

  it("at least one path from start to a boss exists", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    expect(hasReachableBoss(map)).toBe(true);
  });

  it("does not generate treasure nodes", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    for (const row of map.grid) {
      for (const node of row) {
        expect(node?.type).not.toBe("treasure");
      }
    }
  });

  it("every placed node has one to three connections", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    for (const row of map.grid) {
      for (const node of row) {
        if (!node) continue;
        expect(node.connections.length).toBeGreaterThanOrEqual(1);
        expect(node.connections.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("creates branching choice points", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const branchCount = map.grid.flat().filter((node) => node && node.connections.length === 3).length;
    expect(branchCount).toBeGreaterThanOrEqual(2);
  });

  it("uses fixed modifier counts for combat and elite nodes", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    for (const node of map.grid.flat()) {
      if (node?.type === "combat") expect(node.modifiers).toHaveLength(1);
      if (node?.type === "elite") expect(node.modifiers).toHaveLength(2);
    }
  });

  it("assigns reward modifiers on some combat and all elite nodes", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    for (const node of map.grid.flat()) {
      if (node?.type === "elite") expect(node.rewardModifiers).toHaveLength(1);
      if (node?.type === "combat") expect(node.rewardModifiers.length).toBeLessThanOrEqual(1);
    }
  });

  it("every connection points back to its source", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const node = map.grid[row][col];
        if (!node) continue;
        for (const connection of node.connections) {
          const target = map.grid[connection.row][connection.col];
          expect(target?.connections).toContainEqual({ row, col });
        }
      }
    }
  });

  it("every checked seed has a reachable boss path", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const map = generateLabyrinthMap(createSeededRng(seed));
      expect(hasReachableBoss(map)).toBe(true);
    }
  });

  it("final row contains at least one boss node", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const bossNodes = map.grid[ROWS - 1].filter((n) => n?.type === "boss");
    expect(bossNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("seeded RNG produces identical maps for the same seed", () => {
    const mapA = generateLabyrinthMap(createSeededRng(123));
    const mapB = generateLabyrinthMap(createSeededRng(123));
    // Compare the grid structure: type and position must match.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = mapA.grid[r][c];
        const b = mapB.grid[r][c];
        if (a === null && b === null) continue;
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        expect(a!.type).toBe(b!.type);
      }
    }
  });

  it("different seeds produce different maps", () => {
    const mapA = generateLabyrinthMap(createSeededRng(1));
    const mapB = generateLabyrinthMap(createSeededRng(2));
    // Compare grid structure — almost certainly different.
    let same = true;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = mapA.grid[r][c];
        const b = mapB.grid[r][c];
        if (a === null && b === null) continue;
        if (a === null || b === null || a.type !== b.type) {
          same = false;
          break;
        }
      }
      if (!same) break;
    }
    expect(same).toBe(false);
  });
});

describe("revealConnected", () => {
  it("marks hidden neighbors as visible", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    // After generation, the full route is visible.
    const start = map.grid[0][START_COL]!;
    expect(start.state).toBe("current");
    for (const conn of start.connections) {
      const neighbor = map.grid[conn.row][conn.col];
      expect(neighbor).not.toBeNull();
      expect(neighbor!.state).toBe("visible");
    }
  });

  it("does nothing if current node has no connections", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    // Force a node at (0, 0) with no connections.
    map.grid[0][0] = { type: "combat", modifiers: [], rewardModifiers: [], connections: [], state: "hidden" };
    map.currentNode = { row: 0, col: 0 };
    revealConnected(map);
    expect(map.grid[0][0]!.state).toBe("hidden"); // unchanged, no connections
  });
});

describe("setCurrentNode", () => {
  it("marks previous current as cleared and sets new current", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    // Start node is "current" after generation.
    const start = map.grid[0][START_COL]!;
    expect(start.state).toBe("current");

    // Move to a connected node.
    if (start.connections.length > 0) {
      const target = start.connections[0];
      setCurrentNode(map, target.row, target.col);
      expect(start.state).toBe("cleared");
      const newNode = map.grid[target.row][target.col]!;
      expect(newNode.state).toBe("current");
      expect(map.currentNode).toEqual({ row: target.row, col: target.col });
    }
  });
});

describe("failNode", () => {
  it("marks node as failed and resets position to start", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const start = map.grid[0][START_COL]!;
    // Move to a connected node first.
    if (start.connections.length > 0) {
      const target = start.connections[0];
      setCurrentNode(map, target.row, target.col);
      failNode(map, target.row, target.col);
      const failed = map.grid[target.row][target.col]!;
      expect(failed.state).toBe("failed");
      expect(map.currentNode).toEqual({ row: 0, col: START_COL });
    }
  });
});

describe("createSeededRng", () => {
  it("produces values in [0, 1)", () => {
    const rng = createSeededRng(99);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic", () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });
});

function hasReachableBoss(map: ReturnType<typeof generateLabyrinthMap>): boolean {
  const visited = new Set<string>();
  const queue = [{ row: 0, col: START_COL }];
  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const key = `${row},${col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const node = map.grid[row][col];
    if (!node) continue;
    if (node.type === "boss") return true;
    for (const conn of node.connections) {
      queue.push(conn);
    }
  }
  return false;
}

function shortestBossPathNodeCount(map: ReturnType<typeof generateLabyrinthMap>): number {
  const visited = new Set<string>();
  const queue = [{ row: 0, col: START_COL, count: 1 }];
  while (queue.length > 0) {
    const { row, col, count } = queue.shift()!;
    const key = `${row},${col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const node = map.grid[row][col];
    if (!node) continue;
    if (node.type === "boss") return count;
    for (const conn of node.connections) {
      queue.push({ ...conn, count: count + 1 });
    }
  }
  return 0;
}
