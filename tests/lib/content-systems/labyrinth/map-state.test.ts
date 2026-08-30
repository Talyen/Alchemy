import { describe, expect, it } from "vitest";
import {
  canEnterLabyrinthNode,
  cloneLabyrinthMap,
  isNodeReachable,
  labyrinthNodeVisualState,
  withClearedNode,
} from "@/lib/content-systems/labyrinth/map-state";
import { LABYRINTH_ENTRANCE_NODE_ID, LABYRINTH_ENTRANCE_FLOOR_ID } from "@/lib/content-systems/labyrinth/data";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";

function node(
  partial: Partial<LabyrinthNode> & Pick<LabyrinthNode, "id" | "type" | "floor" | "gridPosition">,
): LabyrinthNode {
  return {
    modifiers: [],
    rewardModifiers: [],
    outgoingIds: [],
    cleared: false,
    ...partial,
  };
}

function makeMap(nodes: LabyrinthNode[], currentFloor = 1): LabyrinthMap {
  const byFloor = new Map<number, string[]>();
  for (const entry of nodes) {
    const list = byFloor.get(entry.floor) ?? [];
    list.push(entry.id);
    byFloor.set(entry.floor, list);
  }
  return {
    currentFloor,
    floors: [...byFloor.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([depth, nodeIds]) => ({
        id: depth === 0 ? LABYRINTH_ENTRANCE_FLOOR_ID : `labyrinth-floor-${depth}`,
        depth,
        nodeIds,
      })),
    nodes: Object.fromEntries(nodes.map((entry) => [entry.id, entry])),
  };
}

describe("labyrinth reachability", () => {
  const entrance = node({
    id: LABYRINTH_ENTRANCE_NODE_ID,
    type: "entrance",
    floor: 0,
    gridPosition: { row: 0, col: 0 },
    cleared: true,
    outgoingIds: ["f1-n0"],
  });
  const combat = node({
    id: "f1-n0",
    type: "combat",
    floor: 1,
    gridPosition: { row: 0, col: 0 },
  });
  const rest = node({
    id: "f1-n1",
    type: "rest",
    floor: 1,
    gridPosition: { row: 1, col: 0 },
  });
  const map = makeMap([entrance, combat, rest]);

  it("marks the floor entry reachable via the cleared entrance outgoing link", () => {
    expect(canEnterLabyrinthNode(map, "f1-n0")).toBe(true);
    expect(labyrinthNodeVisualState(map, "f1-n0")).toBe("reachable");
  });

  it("keeps hex neighbors locked until the adjacent node is cleared", () => {
    expect(isNodeReachable(map, "f1-n1")).toBe(false);
    const next = withClearedNode(map, "f1-n0");
    expect(isNodeReachable(next, "f1-n1")).toBe(true);
    expect(labyrinthNodeVisualState(next, "f1-n0")).toBe("cleared");
  });

  it("does not mutate the original map when clearing", () => {
    const original = cloneLabyrinthMap(map);
    withClearedNode(map, "f1-n0");
    expect(map.nodes["f1-n0"]?.cleared).toBe(false);
    expect(original.nodes["f1-n0"]?.cleared).toBe(false);
  });

  it("rejects already-cleared and unknown nodes", () => {
    expect(canEnterLabyrinthNode(map, LABYRINTH_ENTRANCE_NODE_ID)).toBe(false);
    expect(canEnterLabyrinthNode(map, "missing")).toBe(false);
  });

  it("preserves map reference when attempting to clear an already-cleared or missing node", () => {
    expect(withClearedNode(map, LABYRINTH_ENTRANCE_NODE_ID)).toBe(map);
    expect(withClearedNode(map, "missing")).toBe(map);
  });
});
