// Unit tests for hex-floor labyrinth generation, reachability, and boss expansion.
import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/lib/utils";
import {
  canEnterLabyrinthNode,
  createMinimalLabyrinthMap,
  expandBeyondBoss,
  generateLabyrinthMap,
  withClearedLabyrinthNode,
} from "@/lib/content-systems/labyrinth/map-generation";
import { floorNodes, isNodeReachable, labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import { LABYRINTH_ENTRANCE_NODE_ID } from "@/lib/content-systems/labyrinth/data";
import { LABYRINTH_HEX, areHexesAdjacent, isHexInBounds } from "@/lib/content-systems/labyrinth/hex-grid";
import { isValidFloorLayout } from "@/lib/content-systems/labyrinth/hex-layout";

function playableNodes(map: ReturnType<typeof generateLabyrinthMap>) {
  return Object.values(map.nodes).filter((node) => node.floor > 0);
}

describe("generateLabyrinthMap", () => {
  it("starts with a cleared entrance and a playable floor 1", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    expect(map.currentFloor).toBe(1);
    expect(map.nodes[LABYRINTH_ENTRANCE_NODE_ID]?.cleared).toBe(true);
    expect(map.nodes[LABYRINTH_ENTRANCE_NODE_ID]?.type).toBe("entrance");
    const floor1 = playableNodes(map);
    expect(floor1.length).toBeGreaterThanOrEqual(LABYRINTH_HEX.minNodesPerFloor);
    expect(floor1.length).toBeLessThanOrEqual(LABYRINTH_HEX.maxNodesPerFloor);
    expect(floor1[0]?.type).toBe("combat");
    expect(floor1.some((node) => node.type === "boss")).toBe(true);
  });

  it("first floor node is always combat and reachable from the entrance", () => {
    for (const seed of [1, 7, 13, 19, 25, 42, 99, 100]) {
      const map = generateLabyrinthMap(createSeededRng(seed));
      const entryId = map.nodes[LABYRINTH_ENTRANCE_NODE_ID]!.outgoingIds[0]!;
      expect(map.nodes[entryId]?.type).toBe("combat");
      expect(canEnterLabyrinthNode(map, entryId)).toBe(true);
    }
  });

  it("keeps floor layouts within hex bounds and unique cells", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const seen = new Set<string>();
    for (const node of floorNodes(map, 1)) {
      expect(isHexInBounds(node.gridPosition)).toBe(true);
      const key = `${node.gridPosition.row},${node.gridPosition.col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = generateLabyrinthMap(createSeededRng(123));
    const b = generateLabyrinthMap(createSeededRng(123));
    expect(Object.keys(a.nodes).sort()).toEqual(Object.keys(b.nodes).sort());
    for (const id of Object.keys(a.nodes)) {
      expect(a.nodes[id]).toEqual(b.nodes[id]);
    }
  });

  it("differs across seeds", () => {
    const a = generateLabyrinthMap(createSeededRng(1));
    const b = generateLabyrinthMap(createSeededRng(2));
    expect(JSON.stringify(a.nodes)).not.toBe(JSON.stringify(b.nodes));
  });

  it("assigns enemy ids to combat, elite, and boss nodes", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    for (const node of Object.values(map.nodes)) {
      if (node.type === "combat" || node.type === "elite" || node.type === "boss") {
        expect(node.enemyId).toBeTruthy();
      }
    }
  });
});

describe("hex floor layouts", () => {
  it("generated floor positions branch and merge without dead-end rooms", () => {
    for (const seed of [1, 8, 15, 22, 29, 36, 43, 50]) {
      const map = generateLabyrinthMap(createSeededRng(seed));
      const positions = floorNodes(map, 1).map((node) => node.gridPosition);
      expect(isValidFloorLayout(positions)).toBe(true);
    }
  });
});

describe("canEnterLabyrinthNode", () => {
  it("rejects the entrance and uncleared non-adjacent rooms", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    expect(canEnterLabyrinthNode(map, LABYRINTH_ENTRANCE_NODE_ID)).toBe(false);
    const boss = Object.values(map.nodes).find((node) => node.type === "boss")!;
    expect(canEnterLabyrinthNode(map, boss.id)).toBe(false);
  });

  it("unlocks hex neighbors after a node is cleared", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const entryId = map.nodes[LABYRINTH_ENTRANCE_NODE_ID]!.outgoingIds[0]!;
    const cleared = withClearedLabyrinthNode(map, entryId, createSeededRng(1));
    const entry = cleared.nodes[entryId]!;
    const neighbor = floorNodes(cleared, 1).find(
      (node) => node.id !== entryId && areHexesAdjacent(entry.gridPosition, node.gridPosition),
    );
    expect(neighbor).toBeDefined();
    expect(isNodeReachable(cleared, neighbor!.id)).toBe(true);
    expect(labyrinthNodeVisualState(cleared, entryId)).toBe("cleared");
  });
});

describe("withClearedLabyrinthNode boss expansion", () => {
  it("appends the next floor when the floor boss is cleared", () => {
    const map = createMinimalLabyrinthMap();
    const combat = Object.values(map.nodes).find((node) => node.type === "combat")!;
    const rest = Object.values(map.nodes).find((node) => node.type === "rest")!;
    const boss = Object.values(map.nodes).find((node) => node.type === "boss")!;
    let next = withClearedLabyrinthNode(map, combat.id, createSeededRng(1));
    next = withClearedLabyrinthNode(next, rest.id, createSeededRng(2));
    next = withClearedLabyrinthNode(next, boss.id, createSeededRng(3));
    expect(next.currentFloor).toBe(2);
    expect(floorNodes(next, 2).some((node) => node.type === "boss")).toBe(true);
    expect(next.nodes[boss.id]?.outgoingIds.length).toBe(1);
  });

  it("expandBeyondBoss is a no-op until the boss is cleared", () => {
    const map = createMinimalLabyrinthMap();
    const boss = Object.values(map.nodes).find((node) => node.type === "boss")!;
    const next = expandBeyondBoss(map, boss.id, createSeededRng(9));
    expect(next.floors).toHaveLength(map.floors.length);
  });
});
