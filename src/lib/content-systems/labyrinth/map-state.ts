import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeVisualState } from "../types";
import { gridKey, neighboringGridKeys } from "./grid";

export function floorNodes(map: LabyrinthMap, depth: number): LabyrinthNode[] {
  const floor = map.floors.find((entry) => entry.depth === depth);
  if (!floor) return [];
  return floor.nodeIds.map((id) => map.nodes[id]).filter((node): node is LabyrinthNode => Boolean(node));
}

export function labyrinthFloorVisualStates(map: LabyrinthMap): Map<string, LabyrinthNodeVisualState> {
  const nodes = floorNodes(map, map.currentFloor);
  const cleared = new Set<string>();
  for (const node of nodes) {
    if (node.cleared) cleared.add(gridKey(node.gridPosition));
  }
  const states = new Map<string, LabyrinthNodeVisualState>();
  for (const node of nodes) {
    if (node.cleared) {
      states.set(node.id, "cleared");
      continue;
    }
    const reachable = neighboringGridKeys(node.gridPosition).some((key) => cleared.has(key));
    states.set(node.id, reachable ? "reachable" : node.type === "boss" ? "locked" : "undiscovered");
  }
  return states;
}

export function isNodeDiscovered(map: LabyrinthMap, nodeId: string): boolean {
  return labyrinthNodeVisualState(map, nodeId) !== "undiscovered";
}

export function canEnterLabyrinthNode(map: LabyrinthMap, nodeId: string): boolean {
  return labyrinthNodeVisualState(map, nodeId) === "reachable";
}

export function labyrinthNodeVisualState(map: LabyrinthMap, nodeId: string): LabyrinthNodeVisualState {
  const node = map.nodes[nodeId];
  if (!node || node.floor !== map.currentFloor) return "undiscovered";
  return labyrinthFloorVisualStates(map).get(nodeId) ?? "undiscovered";
}

export function canInspectLabyrinthNode(map: LabyrinthMap, nodeId: string): boolean {
  return isNodeDiscovered(map, nodeId);
}

export function canDescendFromLabyrinthNode(map: LabyrinthMap, nodeId: string): boolean {
  const node = map.nodes[nodeId];
  return Boolean(node && node.floor === map.currentFloor && node.type === "boss" && node.cleared);
}

export function withClearedNode(map: LabyrinthMap, nodeId: string): LabyrinthMap {
  const node = map.nodes[nodeId];
  if (!node || !canEnterLabyrinthNode(map, nodeId)) return map;
  return {
    ...map,
    currentNodeId: nodeId,
    nodes: {
      ...map.nodes,
      [nodeId]: { ...node, cleared: true },
    },
  };
}
