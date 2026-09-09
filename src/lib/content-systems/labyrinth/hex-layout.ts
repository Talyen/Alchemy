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

function computeAllDegrees(positions: readonly LabyrinthGridPosition[]): number[] {
  const degrees = new Array<number>(positions.length).fill(0);
  for (let i = 0; i < positions.length; i += 1) {
    const source = positions[i]!;
    for (let j = i + 1; j < positions.length; j += 1) {
      if (areHexesAdjacent(source, positions[j]!)) {
        degrees[i] = (degrees[i] ?? 0) + 1;
        degrees[j] = (degrees[j] ?? 0) + 1;
      }
    }
  }
  return degrees;
}

export function hexDegree(positions: readonly LabyrinthGridPosition[], index: number): number {
  const source = positions[index];
  if (!source) return 0;
  let count = 0;
  for (let i = 0; i < positions.length; i += 1) {
    if (i !== index && areHexesAdjacent(source, positions[i]!)) {
      count += 1;
    }
  }
  return count;
}

export function floorLayoutCycleCount(
  positions: readonly LabyrinthGridPosition[],
  degrees: readonly number[] = computeAllDegrees(positions),
): number {
  const edgeCount = degrees.reduce((sum, degree) => sum + degree, 0) / 2;
  return edgeCount - positions.length + 1;
}

function isWindingRoute(route: readonly LabyrinthGridPosition[]): boolean {
  let direction = 0;
  let turns = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]!;
    const current = route[index]!;
    if (current.row < previous.row) return false;
    if (current.row !== previous.row) continue;
    const nextDirection = Math.sign(current.col - previous.col);
    if (direction !== 0 && nextDirection !== direction) turns += 1;
    direction = nextDirection;
  }
  return turns >= 2;
}

function hasCompactSidePockets(
  positions: readonly LabyrinthGridPosition[],
  route: readonly LabyrinthGridPosition[],
): boolean {
  const routeIndices = new Map(route.map((position, index) => [hexKey(position), index]));
  const remaining = new Set(positions.filter((position) => !routeIndices.has(hexKey(position))));
  if (remaining.size === 0) return false;
  let pockets = 0;
  for (const start of remaining) {
    pockets += 1;
    if (pockets > 2) return false;
    const pocket = [start];
    const attachments: number[] = [];
    remaining.delete(start);
    for (const source of pocket) {
      for (const target of positions) {
        if (!areHexesAdjacent(source, target)) continue;
        const routeIndex = routeIndices.get(hexKey(target));
        if (routeIndex !== undefined) attachments.push(routeIndex);
        if (remaining.delete(target)) pocket.push(target);
      }
    }
    if (pocket.length > 2 || attachments.length === 0) return false;
    if (Math.max(...attachments) - Math.min(...attachments) > 1) return false;
  }
  return true;
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

  const degrees = computeAllDegrees(positions);
  if (degrees[0] !== 1 || degrees[degrees.length - 1] !== 1) return false;
  if (degrees.some((degree) => degree > LABYRINTH_HEX.maxNodeDegree)) return false;

  const visualColumns = positions.map(hexVisualColumn);
  if (Math.max(...visualColumns) - Math.min(...visualColumns) < 4) return false;

  const distances = new Map([[hexKey(positions[0]!), 0]]);
  const paths = new Map([[hexKey(positions[0]!), [positions[0]!]]]);
  const frontier = [positions[0]!];
  for (let index = 0; index < frontier.length; index += 1) {
    const source = frontier[index]!;
    for (const target of positions) {
      const key = hexKey(target);
      if (!areHexesAdjacent(source, target) || distances.has(key)) continue;
      distances.set(key, distances.get(hexKey(source))! + 1);
      paths.set(key, [...paths.get(hexKey(source))!, target]);
      frontier.push(target);
    }
  }
  if (distances.size !== positions.length) return false;
  const bossDistance = distances.get(hexKey(positions[positions.length - 1]!));
  if (bossDistance !== Math.max(...distances.values())) return false;

  const route = paths.get(hexKey(positions[positions.length - 1]!))!;
  return isWindingRoute(route) && hasCompactSidePockets(positions, route);
}

const FLOOR_TEMPLATES: Record<number, readonly string[]> = {
  12: [
    "...E#/#...#/.####/#..../.##B.",
    "..E##/....#/.####/#...#/.#B..",
    ".#E.#/#...#/.####/....#/...B#",
    "E##../..#../.###./#..../.###B",
    "...#E/.##../...##/....#/B####",
    ".###E/#..../.###./..#../B##..",
  ],
  13: [
    "...E#/.#..#/.####/#..../.###B",
    ".##E./#..../.###./...##/B###.",
    "###E./#..../.####/....#/..B##",
    ".#E../#...#/.####/#...#/#..B#",
    "...#E/###../...##/....#/B####",
    "E###./...#./.####/#..../.##B.",
  ],
  14: [
    ".#.E#/#...#/.####/#..../.###B",
    ".#E../#...#/.####/#...#/#.B##",
    ".E###/....#/#####/#...#/.#B..",
    "E###./...##/####./#..../.##B.",
    "..#E./.#.../#####/....#/B####",
    "####E/#..../.####/#...#/...B#",
  ],
};

function parseTemplate(template: string, count: number): LabyrinthGridPosition[] {
  const middle: LabyrinthGridPosition[] = [];
  let entrance: LabyrinthGridPosition | undefined;
  let boss: LabyrinthGridPosition | undefined;
  for (const [row, cells] of template.split("/").entries()) {
    for (let column = 0; column < cells.length; column += 1) {
      const cell = cells[column];
      const position = hexAt(row, column);
      if (cell === "E") entrance = position;
      else if (cell === "B") boss = position;
      else if (cell === "#") middle.push(position);
    }
  }
  const positions = entrance && boss ? [entrance, ...middle.sort(compareHexPositions), boss] : [];
  if (positions.length !== count || !isValidFloorLayout(positions)) {
    throw new Error(`Invalid ${count}-chamber Labyrinth template: ${template}`);
  }
  return positions;
}

const PREVALIDATED_LAYOUTS = Object.fromEntries(
  Object.entries(FLOOR_TEMPLATES).map(([count, templates]) => [
    Number(count),
    templates.map((template) => parseTemplate(template, Number(count))),
  ]),
);

export function generateFloorLayout(nodeCount: number, rng: () => number): LabyrinthGridPosition[] {
  const clamped = Math.min(LABYRINTH_HEX.maxNodesPerFloor, Math.max(LABYRINTH_HEX.minNodesPerFloor, nodeCount));
  const layouts = PREVALIDATED_LAYOUTS[clamped] ?? [];
  const selected = pickRandom(layouts, rng);
  if (!selected) throw new Error(`Labyrinth floor constraints must produce a layout for ${clamped} chambers`);
  return selected.map((position) => ({ ...position }));
}
