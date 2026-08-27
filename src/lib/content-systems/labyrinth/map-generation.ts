/**
 * Seeded hex-floor Labyrinth generator. Floor 0 is a cleared entrance; floor 1+
 * expand when the current floor boss is cleared.
 */
import { pickRandom, shuffle } from "@/lib/utils";
import { enemiesByType, type EnemyType } from "@/lib/game-data";

import type { LabyrinthFloor, LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "../types";
import {
  LABYRINTH_ENTRANCE_FLOOR_ID,
  LABYRINTH_ENTRANCE_NODE_ID,
  LABYRINTH_SUPPORT_TYPES,
  labyrinthFloorId,
  labyrinthNodeId,
} from "./data";
import { LABYRINTH_HEX } from "./hex-grid";
import { generateFloorLayout } from "./hex-layout";
import { getEnemyModifiersForNodeType, getRewardModifiersForNodeType } from "./modifiers";
import { cloneLabyrinthMap, withClearedNode } from "./map-state";

export { canEnterLabyrinthNode } from "./map-state";

const COMBAT_NODE_TYPES = new Set<LabyrinthNodeType>(["combat", "elite", "boss"]);

function randomInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function usedEnemyIds(map: LabyrinthMap): Set<string> {
  return new Set(Object.values(map.nodes).flatMap((node) => (node.enemyId ? [node.enemyId] : [])));
}

function pickEnemyId(type: EnemyType, used: ReadonlySet<string>, rng: () => number): string | undefined {
  const pool = enemiesByType[type];
  const preferred = pool.filter((enemy) => !used.has(enemy.id));
  const candidates = preferred.length > 0 ? preferred : pool;
  return pickRandom(candidates, rng)?.id;
}

function plannedTypes(count: number, rng: () => number): LabyrinthNodeType[] {
  const support = shuffle(LABYRINTH_SUPPORT_TYPES, rng);
  const middle: LabyrinthNodeType[] = support.slice(0, Math.min(3, count - 2));
  const weighted: LabyrinthNodeType[] = [
    "combat",
    "combat",
    "elite",
    "mystery",
    "rest",
    "shop",
    "alchemist",
    "trinket-shop",
    "equipment-shop",
  ];
  while (middle.length < count - 2) {
    const next = pickRandom(weighted, rng) ?? "combat";
    if (LABYRINTH_SUPPORT_TYPES.includes(next as (typeof LABYRINTH_SUPPORT_TYPES)[number]) && middle.includes(next)) {
      middle.push("combat");
    } else {
      middle.push(next);
    }
  }
  return ["combat", ...shuffle(middle, rng), "boss"];
}

function makeNode(input: {
  id: string;
  type: LabyrinthNodeType;
  floor: number;
  gridPosition: LabyrinthNode["gridPosition"];
  rng: () => number;
  enemyId?: string;
  outgoingIds?: string[];
  cleared?: boolean;
}): LabyrinthNode {
  const combatType = input.type === "combat" || input.type === "elite" || input.type === "boss" ? input.type : null;
  const node: LabyrinthNode = {
    id: input.id,
    type: input.type,
    floor: input.floor,
    gridPosition: input.gridPosition,
    modifiers: combatType ? getEnemyModifiersForNodeType(combatType, input.rng) : [],
    rewardModifiers: combatType ? getRewardModifiersForNodeType(combatType, input.rng) : [],
    outgoingIds: input.outgoingIds ?? [],
    cleared: input.cleared ?? false,
  };
  if (input.enemyId) node.enemyId = input.enemyId;
  return node;
}

function generateFloor(
  depth: number,
  rng: () => number,
  usedEnemies: ReadonlySet<string>,
): { floor: LabyrinthFloor; nodes: LabyrinthNode[]; entryId: string } {
  const count = randomInt(LABYRINTH_HEX.minNodesPerFloor, LABYRINTH_HEX.maxNodesPerFloor, rng);
  const types = plannedTypes(count, rng);
  const positions = generateFloorLayout(count, rng);
  if (positions.length !== count) {
    throw new Error(`Labyrinth floor layout length ${positions.length} does not match node count ${count}`);
  }
  const used = new Set(usedEnemies);
  const nodes = types.map((type, index) => {
    const enemyType: EnemyType = type === "boss" ? "boss" : type === "elite" ? "elite" : "normal";
    const enemyId = COMBAT_NODE_TYPES.has(type) ? pickEnemyId(enemyType, used, rng) : undefined;
    if (enemyId) used.add(enemyId);
    return makeNode({
      id: labyrinthNodeId(depth, index),
      type,
      floor: depth,
      gridPosition: positions[index]!,
      rng,
      ...(enemyId ? { enemyId } : {}),
    });
  });
  const entryId = nodes[0]!.id;
  return {
    floor: { id: labyrinthFloorId(depth), depth, nodeIds: nodes.map((node) => node.id) },
    nodes,
    entryId,
  };
}

function makeEntranceNode(outgoingIds: string[]): LabyrinthNode {
  return {
    id: LABYRINTH_ENTRANCE_NODE_ID,
    type: "entrance",
    floor: 0,
    gridPosition: { row: 0, col: 0 },
    modifiers: [],
    rewardModifiers: [],
    outgoingIds,
    cleared: true,
  };
}

export function generateLabyrinthMap(rng: () => number): LabyrinthMap {
  const first = generateFloor(1, rng, new Set());
  const nodes: Record<string, LabyrinthNode> = Object.fromEntries(first.nodes.map((node) => [node.id, node]));
  const entrance = makeEntranceNode([first.entryId]);
  nodes[entrance.id] = entrance;
  return {
    currentFloor: 1,
    floors: [{ id: LABYRINTH_ENTRANCE_FLOOR_ID, depth: 0, nodeIds: [entrance.id] }, first.floor],
    nodes,
  };
}

export function expandBeyondBoss(map: LabyrinthMap, bossId: string, rng: () => number): LabyrinthMap {
  const next = cloneLabyrinthMap(map);
  const boss = next.nodes[bossId];
  if (!boss || boss.type !== "boss" || !boss.cleared || boss.outgoingIds.length > 0) return next;

  const generated = generateFloor(boss.floor + 1, rng, usedEnemyIds(next));
  next.floors.push(generated.floor);
  for (const node of generated.nodes) next.nodes[node.id] = node;
  next.nodes[bossId] = { ...boss, outgoingIds: [generated.entryId] };
  next.currentFloor = generated.floor.depth;
  return next;
}

export function withClearedLabyrinthNode(map: LabyrinthMap, nodeId: string, rng: () => number): LabyrinthMap {
  const cleared = withClearedNode(map, nodeId);
  const node = cleared.nodes[nodeId];
  if (node?.type === "boss") return expandBeyondBoss(cleared, nodeId, rng);
  return cleared;
}

/** Linear three-node floor for E2E / schema fixtures. */
export function createMinimalLabyrinthMap(): LabyrinthMap {
  const combatId = labyrinthNodeId(1, 0);
  const restId = labyrinthNodeId(1, 1);
  const bossId = labyrinthNodeId(1, 2);
  const combat: LabyrinthNode = {
    id: combatId,
    type: "combat",
    floor: 1,
    gridPosition: { row: 0, col: 0 },
    modifiers: [],
    rewardModifiers: [],
    outgoingIds: [],
    cleared: false,
  };
  const combatEnemyId = enemiesByType.normal[0]?.id;
  if (combatEnemyId) combat.enemyId = combatEnemyId;
  const rest: LabyrinthNode = {
    id: restId,
    type: "rest",
    floor: 1,
    gridPosition: { row: 1, col: 0 },
    modifiers: [],
    rewardModifiers: [],
    outgoingIds: [],
    cleared: false,
  };
  const boss: LabyrinthNode = {
    id: bossId,
    type: "boss",
    floor: 1,
    gridPosition: { row: 2, col: 0 },
    modifiers: [],
    rewardModifiers: [],
    outgoingIds: [],
    cleared: false,
  };
  const bossEnemyId = enemiesByType.boss[0]?.id;
  if (bossEnemyId) boss.enemyId = bossEnemyId;
  const entrance = makeEntranceNode([combatId]);
  return {
    currentFloor: 1,
    floors: [
      { id: LABYRINTH_ENTRANCE_FLOOR_ID, depth: 0, nodeIds: [entrance.id] },
      { id: labyrinthFloorId(1), depth: 1, nodeIds: [combatId, restId, bossId] },
    ],
    nodes: {
      [entrance.id]: entrance,
      [combatId]: combat,
      [restId]: rest,
      [bossId]: boss,
    },
  };
}
