/**
 * Valid hex floor layouts: connected path, leaf entry/boss, max degree 3, optional loop.
 */
import { pickRandom } from "@/lib/utils";

import type { LabyrinthGridPosition } from "../types";
import { LABYRINTH_HEX, areHexesAdjacent, hexKey, hexNeighbors, isHexInBounds, compareHexPositions } from "./hex-grid";

export function hexDegree(positions: readonly LabyrinthGridPosition[], index: number): number {
  const source = positions[index];
  if (!source) return 0;
  return positions.reduce((count, target, targetIndex) => {
    if (targetIndex === index) return count;
    return count + (areHexesAdjacent(source, target) ? 1 : 0);
  }, 0);
}

export function isValidFloorLayout(positions: readonly LabyrinthGridPosition[], closesLoop: boolean): boolean {
  if (positions.length < 3) return false;
  const degrees = positions.map((_, index) => hexDegree(positions, index));
  if (degrees[0] !== 1 || degrees[degrees.length - 1] !== 1) return false;
  if (degrees.some((degree) => degree > LABYRINTH_HEX.maxNodeDegree)) return false;
  if (!degrees.includes(LABYRINTH_HEX.maxNodeDegree)) return false;

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

  const edgeCount = degrees.reduce((sum, degree) => sum + degree, 0) / 2;
  const cycleCount = edgeCount - positions.length + 1;
  return cycleCount === (closesLoop ? 1 : 0);
}

function unusedInBoundsNeighbors(
  positions: readonly LabyrinthGridPosition[],
  used: ReadonlySet<string>,
): LabyrinthGridPosition[] {
  const candidates: LabyrinthGridPosition[] = [];
  const seen = new Set<string>();
  for (const position of positions) {
    for (const neighbor of hexNeighbors(position)) {
      const key = hexKey(neighbor);
      if (seen.has(key) || used.has(key) || !isHexInBounds(neighbor)) continue;
      seen.add(key);
      candidates.push(neighbor);
    }
  }
  return candidates;
}

function orderLayout(positions: LabyrinthGridPosition[], bossIndex: number): LabyrinthGridPosition[] {
  const entrance = positions[0]!;
  const boss = positions[bossIndex]!;
  const middle = positions.filter((_, index) => index !== 0 && index !== bossIndex).sort(compareHexPositions);
  return [entrance, ...middle, boss];
}

function tryGrowLayout(nodeCount: number, closesLoop: boolean, rng: () => number): LabyrinthGridPosition[] | null {
  const entrance: LabyrinthGridPosition = { row: 0, col: 0 };
  const firstNeighbors = hexNeighbors(entrance).filter(
    (neighbor) => isHexInBounds(neighbor) && neighbor.row >= entrance.row,
  );
  const first = pickRandom(firstNeighbors, rng);
  if (!first) return null;

  const positions: LabyrinthGridPosition[] = [entrance, first];
  const used = new Set([hexKey(entrance), hexKey(first)]);

  while (positions.length < nodeCount) {
    const growFrom = positions.slice(1);
    const candidates = unusedInBoundsNeighbors(growFrom, used).filter(
      (candidate) => !areHexesAdjacent(candidate, entrance),
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.row - a.row || a.col - b.col);
    const window = Math.max(1, Math.ceil(candidates.length / 2));
    const pick = candidates[Math.floor(rng() * window)]!;
    positions.push(pick);
    used.add(hexKey(pick));
  }

  const degrees = positions.map((_, index) => hexDegree(positions, index));
  if (degrees[0] !== 1) return null;

  let bossIndex = -1;
  let bossRow = -1;
  for (let index = 1; index < positions.length; index += 1) {
    if (degrees[index] !== 1) continue;
    const row = positions[index]!.row;
    if (row >= bossRow) {
      bossRow = row;
      bossIndex = index;
    }
  }
  if (bossIndex < 0) return null;

  const ordered = orderLayout(positions, bossIndex);
  return isValidFloorLayout(ordered, closesLoop) ? ordered : null;
}

const FALLBACK_LAYOUTS: Record<number, LabyrinthGridPosition[]> = {
  9: [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: -1 },
    { row: 3, col: -1 },
    { row: 3, col: 0 },
    { row: 4, col: -2 },
    { row: 5, col: -2 },
    { row: 5, col: -1 },
    { row: 5, col: 0 },
  ],
  10: [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: -1 },
    { row: 3, col: -1 },
    { row: 3, col: 0 },
    { row: 4, col: -2 },
    { row: 5, col: -2 },
    { row: 5, col: -1 },
    { row: 5, col: 0 },
    { row: 5, col: 1 },
  ],
  11: [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: -1 },
    { row: 3, col: -1 },
    { row: 3, col: 0 },
    { row: 3, col: 1 },
    { row: 4, col: -2 },
    { row: 5, col: -2 },
    { row: 5, col: -1 },
    { row: 5, col: 0 },
    { row: 5, col: 1 },
  ],
  12: [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: -1 },
    { row: 3, col: -1 },
    { row: 3, col: 0 },
    { row: 3, col: 1 },
    { row: 3, col: 2 },
    { row: 4, col: -2 },
    { row: 5, col: -2 },
    { row: 5, col: -1 },
    { row: 5, col: 0 },
    { row: 5, col: 1 },
  ],
};

export function generateFloorLayout(nodeCount: number, rng: () => number): LabyrinthGridPosition[] {
  const closesLoop = rng() < LABYRINTH_HEX.loopChance;
  for (const wantLoop of [closesLoop, !closesLoop]) {
    for (let attempt = 0; attempt < LABYRINTH_HEX.layoutAttempts; attempt += 1) {
      const layout = tryGrowLayout(nodeCount, wantLoop, rng);
      if (layout) return layout;
    }
  }
  const fallback = FALLBACK_LAYOUTS[nodeCount] ?? FALLBACK_LAYOUTS[9]!;
  return fallback.map((position) => ({ ...position }));
}
