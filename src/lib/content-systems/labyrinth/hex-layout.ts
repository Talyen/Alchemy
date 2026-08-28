import { pickRandom } from "@/lib/utils";

import type { LabyrinthGridPosition } from "../types";
import {
  LABYRINTH_HEX,
  areHexesAdjacent,
  compareHexPositions,
  hexAt,
  hexKey,
  hexVisualColumn,
  isHexInGenerationBounds,
} from "./hex-grid";

export function hexDegree(positions: readonly LabyrinthGridPosition[], index: number): number {
  const source = positions[index];
  if (!source) return 0;
  return positions.reduce((count, target, targetIndex) => {
    if (targetIndex === index) return count;
    return count + (areHexesAdjacent(source, target) ? 1 : 0);
  }, 0);
}

export function floorLayoutCycleCount(positions: readonly LabyrinthGridPosition[]): number {
  const degrees = positions.map((_, index) => hexDegree(positions, index));
  const edgeCount = degrees.reduce((sum, degree) => sum + degree, 0) / 2;
  return edgeCount - positions.length + 1;
}

export function isValidFloorLayout(positions: readonly LabyrinthGridPosition[]): boolean {
  if (positions.length < 3) return false;
  if (positions.some((position) => !isHexInGenerationBounds(position))) return false;
  const seen = new Set<string>();
  for (const position of positions) {
    const key = hexKey(position);
    if (seen.has(key)) return false;
    seen.add(key);
  }

  const degrees = positions.map((_, index) => hexDegree(positions, index));
  const leaves = degrees.filter((degree) => degree === 1);
  if (degrees[0] !== 1 || degrees[degrees.length - 1] !== 1) return false;
  if (leaves.length !== 2) return false;
  if (degrees.some((degree) => degree > LABYRINTH_HEX.maxNodeDegree)) return false;
  if (!degrees.includes(LABYRINTH_HEX.maxNodeDegree)) return false;

  const visualColumns = positions.map(hexVisualColumn);
  if (Math.max(...visualColumns) - Math.min(...visualColumns) < 2) return false;

  const reached = new Set([hexKey(positions[0]!)]);
  const frontier = [positions[0]!];
  while (frontier.length > 0) {
    const source = frontier.pop()!;
    for (const target of positions) {
      if (!areHexesAdjacent(source, target)) continue;
      if (reached.has(hexKey(target))) continue;
      reached.add(hexKey(target));
      frontier.push(target);
    }
  }
  if (reached.size !== positions.length) return false;

  return floorLayoutCycleCount(positions) >= 1;
}

function orderLayout(positions: LabyrinthGridPosition[]): LabyrinthGridPosition[] {
  const entrance = positions[0]!;
  const boss = positions[positions.length - 1]!;
  const middle = positions.slice(1, -1).sort(compareHexPositions);
  return [entrance, ...middle, boss];
}

const TWO_PATH_STEM: LabyrinthGridPosition[] = [
  hexAt(0, 0),
  hexAt(1, 0),
  hexAt(1, 1),
  hexAt(2, 0),
  hexAt(2, 2),
  hexAt(3, 0),
  hexAt(3, 2),
  hexAt(4, 0),
  hexAt(4, 2),
  hexAt(5, 0),
  hexAt(5, 1),
];

const THREE_PATH_STEM: LabyrinthGridPosition[] = [
  hexAt(0, 0),
  hexAt(1, 0),
  hexAt(1, 1),
  hexAt(2, 0),
  hexAt(2, 2),
  hexAt(3, 0),
  hexAt(3, 2),
  hexAt(4, 0),
  hexAt(4, 1),
  hexAt(4, 2),
];

const TAIL_VISUAL_COLUMN = 2;

function withTail(stem: LabyrinthGridPosition[], nodeCount: number): LabyrinthGridPosition[] {
  const tailCount = nodeCount - stem.length;
  const tailStartRow = Math.max(...stem.map((position) => position.row)) + 1;
  const tail: LabyrinthGridPosition[] = [];
  for (let index = 0; index < tailCount; index += 1) {
    tail.push(hexAt(tailStartRow + index, TAIL_VISUAL_COLUMN));
  }
  return orderLayout([...stem, ...tail]);
}

function templatesForCount(nodeCount: number): LabyrinthGridPosition[][] {
  return [withTail(TWO_PATH_STEM, nodeCount), withTail(THREE_PATH_STEM, nodeCount)];
}

export function generateFloorLayout(nodeCount: number, rng: () => number): LabyrinthGridPosition[] {
  const clamped = Math.min(LABYRINTH_HEX.maxNodesPerFloor, Math.max(LABYRINTH_HEX.minNodesPerFloor, nodeCount));
  const valid = templatesForCount(clamped).filter(isValidFloorLayout);
  const selected = pickRandom(valid, rng) ?? valid[0];
  if (!selected) {
    throw new Error(`Labyrinth floor constraints must produce a layout for ${clamped} chambers`);
  }
  return selected.map((position) => ({ ...position }));
}
