import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeVisualState } from "../types";
import { areHexesAdjacent } from "./hex-grid";

export function floorNodes(map: LabyrinthMap, depth: number): LabyrinthNode[] {
  const floor = map.floors.find((entry) => entry.depth === depth);
  if (!floor) return [];
  return floor.nodeIds.map((id) => map.nodes[id]).filter((node): node is LabyrinthNode => Boolean(node));
}

export function isNodeReachable(map: LabyrinthMap, nodeId: string): boolean {
  const node = map.nodes[nodeId];
  if (!node || node.cleared) return false;

  for (const candidate of Object.values(map.nodes)) {
    if (!candidate.cleared) continue;
    if (candidate.outgoingIds.includes(nodeId)) return true;
    if (candidate.floor === node.floor && areHexesAdjacent(candidate.gridPosition, node.gridPosition)) return true;
  }
  return false;
}

export function labyrinthNodeVisualState(map: LabyrinthMap, nodeId: string): LabyrinthNodeVisualState {
  const node = map.nodes[nodeId];
  if (!node || node.cleared) return "cleared";
  return isNodeReachable(map, nodeId) ? "reachable" : "locked";
}

export function canEnterLabyrinthNode(map: LabyrinthMap, nodeId: string): boolean {
  return labyrinthNodeVisualState(map, nodeId) === "reachable";
}

export function cloneLabyrinthMap(map: LabyrinthMap): LabyrinthMap {
  return {
    currentFloor: map.currentFloor,
    floors: map.floors.map((floor) => ({ ...floor, nodeIds: [...floor.nodeIds] })),
    nodes: Object.fromEntries(
      Object.entries(map.nodes).map(([id, node]) => [
        id,
        {
          ...node,
          outgoingIds: [...node.outgoingIds],
          modifiers: [...node.modifiers],
          rewardModifiers: [...node.rewardModifiers],
        },
      ]),
    ),
  };
}

export function withClearedNode(map: LabyrinthMap, nodeId: string): LabyrinthMap {
  const node = map.nodes[nodeId];
  if (!node || node.cleared) return map;
  return {
    ...map,
    nodes: {
      ...map.nodes,
      [nodeId]: { ...node, cleared: true },
    },
  };
}
