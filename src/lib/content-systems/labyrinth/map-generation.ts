/**
 * Procedural map generator for Labyrinth mode using a seeded PRNG.
 * Depends on: data.ts, map-graph.ts, modifiers.ts
 * Depended on by: use-labyrinth-controller.ts, run-session-facade, tests
 */

import { shuffle as shuffleWithRng } from "@/lib/utils";

import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "../types";
import { LABYRINTH_COLS, LABYRINTH_MAP_CONFIG, LABYRINTH_ROWS, LABYRINTH_START_COL, type LabyrinthPoint } from "./data";
import { connect, generateRouteGraph, isBoss, isInRowBand, isStart, samePoint } from "./map-graph";
import { getEnemyModifiersForNodeType, getRewardModifiersForNodeType } from "./modifiers";
import { logError } from "../../error-logger";

export { canEnterLabyrinthNode, setCurrentNode, withCurrentNode, failNode, withFailedNode } from "./map-state";

function initializeEmptyGrid(): (LabyrinthNode | null)[][] {
  return Array.from({ length: LABYRINTH_ROWS }, () => Array.from({ length: LABYRINTH_COLS }, () => null));
}

function filterPointsForBand(
  points: LabyrinthPoint[],
  band: Readonly<{ min: number; max: number }>,
  firstCombat: LabyrinthPoint,
): LabyrinthPoint[] {
  return points.filter((p) => !isStart(p) && !isBoss(p) && !samePoint(p, firstCombat) && isInRowBand(p, band));
}

function determineNodeType(
  point: LabyrinthPoint,
  firstCombat: LabyrinthPoint,
  upperTypes: LabyrinthNodeType[],
  lowerTypes: LabyrinthNodeType[],
): LabyrinthNodeType {
  if (isStart(point)) return "entrance";
  if (isBoss(point)) return "boss";
  if (samePoint(point, firstCombat)) return "combat";

  const { upperRowBand } = LABYRINTH_MAP_CONFIG;
  if (isInRowBand(point, upperRowBand)) {
    return upperTypes.shift()!;
  }
  return lowerTypes.shift()!;
}

export function generateLabyrinthMap(rng: () => number = Math.random): LabyrinthMap {
  const grid = initializeEmptyGrid();
  let graph;
  try {
    graph = generateRouteGraph(rng);
  } catch (cause) {
    console.warn("[Labyrinth] Seeded map generation failed, retrying with Math.random:", cause);
    try {
      graph = generateRouteGraph(() => Math.random());
    } catch (fallbackCause) {
      logError("[Labyrinth] Map generation failed even with Math.random fallback", "validation", {
        error: String(fallbackCause),
      });
      throw Object.assign(new Error("Labyrinth map generation failed after retry"), { rootCause: fallbackCause });
    }
  }
  const firstCombat = { row: 1, col: LABYRINTH_START_COL };
  const { upperRowBand, lowerRowBand } = LABYRINTH_MAP_CONFIG;

  const upperPoints = filterPointsForBand(graph.points, upperRowBand, firstCombat);
  const lowerPoints = filterPointsForBand(graph.points, lowerRowBand, firstCombat);

  const upperTypes = distributeNodeTypes(upperPoints.length, rng, upperRowBand.combatPct, upperRowBand.elitePct);
  const lowerTypes = distributeNodeTypes(lowerPoints.length, rng, lowerRowBand.combatPct, lowerRowBand.elitePct);

  graph.points.forEach((point) => {
    const type = determineNodeType(point, firstCombat, upperTypes, lowerTypes);
    grid[point.row][point.col] = makeNode(type, rng, isStart(point) ? "current" : "visible");
  });

  for (const edge of graph.edges) {
    connect(grid, edge.from, edge.to);
  }

  return {
    grid,
    rows: LABYRINTH_ROWS,
    cols: LABYRINTH_COLS,
    currentNode: graph.points[0],
  };
}

function calculateNodeTypeCounts(
  count: number,
  rng: () => number,
  combatPct: number,
  elitePct: number,
): Record<Exclude<LabyrinthNodeType, "entrance" | "boss">, number> {
  const counts: Record<Exclude<LabyrinthNodeType, "entrance" | "boss">, number> = {
    combat: Math.max(1, Math.round(count * combatPct)),
    elite: Math.max(1, Math.round(count * elitePct)),
    rest: 0,
    mystery: 0,
    shop: 0,
    alchemist: 0,
  };
  const supportTypes: Array<Exclude<LabyrinthNodeType, "entrance" | "combat" | "elite" | "boss">> = [
    "rest",
    "mystery",
    "shop",
    "alchemist",
  ];
  let assigned = counts.combat + counts.elite;
  let supportIndex = Math.floor(rng() * supportTypes.length);

  while (assigned < count) {
    counts[supportTypes[supportIndex % supportTypes.length]] += 1;
    supportIndex += 1;
    assigned += 1;
  }
  while (assigned > count) {
    if (counts.combat > counts.elite && counts.combat > 1) {
      counts.combat -= 1;
    } else if (counts.elite > 1) {
      counts.elite -= 1;
    } else {
      break;
    }
    assigned -= 1;
  }
  return counts;
}

function distributeNodeTypes(count: number, rng: () => number, combatPct = 0.45, elitePct = 0.25): LabyrinthNodeType[] {
  const counts = calculateNodeTypeCounts(count, rng, combatPct, elitePct);
  const pool = Object.entries(counts).flatMap(([type, amount]) =>
    Array.from({ length: amount }, () => type as LabyrinthNodeType),
  );
  return shuffleWithRng(pool, rng);
}

function makeNode(type: LabyrinthNodeType, rng: () => number, state: LabyrinthNode["state"]): LabyrinthNode {
  return {
    type,
    modifiers: type === "combat" || type === "elite" || type === "boss" ? getEnemyModifiersForNodeType(type, rng) : [],
    rewardModifiers:
      type === "combat" || type === "elite" || type === "boss" ? getRewardModifiersForNodeType(type, rng) : [],
    connections: [],
    state,
  };
}
