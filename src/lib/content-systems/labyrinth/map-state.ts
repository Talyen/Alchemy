import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeVisualState } from "../types";
import { areGridNeighbors } from "./grid";

export function floorNodes(map: LabyrinthMap, depth: number): LabyrinthNode[] {
  const floor = map.floors.find((entry) => entry.depth === depth);
  if (!floor) return [];
  return floor.nodeIds.map((id) => map.nodes[id]).filter((node): node is LabyrinthNode => Boolean(node));
}

function hasClearedNeighbor(map: LabyrinthMap, node: LabyrinthNode): boolean {
  return (
    node.floor === map.currentFloor &&
    floorNodes(map, map.currentFloor).some(
      (candidate) => candidate.cleared && areGridNeighbors(candidate.gridPosition, node.gridPosition),
    )
  );
}

export function isNodeDiscovered(map: LabyrinthMap, nodeId: string): boolean {
  const node = map.nodes[nodeId];
  return Boolean(
    node && node.floor === map.currentFloor && (node.cleared || node.type === "boss" || hasClearedNeighbor(map, node)),
  );
}

export function canEnterLabyrinthNode(map: LabyrinthMap, nodeId: string): boolean {
  const node = map.nodes[nodeId];
  return Boolean(node && !node.cleared && hasClearedNeighbor(map, node));
}

export function labyrinthNodeVisualState(map: LabyrinthMap, nodeId: string): LabyrinthNodeVisualState {
  if (!isNodeDiscovered(map, nodeId)) return "undiscovered";
  if (map.nodes[nodeId]?.cleared) return "cleared";
  return canEnterLabyrinthNode(map, nodeId) ? "reachable" : "locked";
}

export function canInspectLabyrinthNode(map: LabyrinthMap, nodeId: string): boolean {
  return isNodeDiscovered(map, nodeId);
}

export function canDescendFromLabyrinthNode(map: LabyrinthMap, nodeId: string): boolean {
  const node = map.nodes[nodeId];
  return Boolean(node && node.floor === map.currentFloor && node.type === "boss" && node.cleared);
}

export function withClearedNode(map: LabyrinthMap, nodeId: string): LabyrinthMap {
  if (!canEnterLabyrinthNode(map, nodeId)) return map;
  return {
    ...map,
    currentNodeId: nodeId,
    nodes: {
      ...map.nodes,
      [nodeId]: { ...map.nodes[nodeId]!, cleared: true },
    },
  };
}
