import { pickRandom, shuffle } from "@/lib/utils";
import { enemiesByType, enemyById, type EnemyType } from "@/lib/game-data";

import type { LabyrinthFloor, LabyrinthGridPosition, LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "../types";
import { LABYRINTH_SUPPORT_TYPES, labyrinthFloorId, labyrinthNodeId } from "./data";
import { LABYRINTH_GRID, areGridNeighbors, gridKey, labyrinthGridPositions } from "./grid";
import { getEnemyModifiersForNodeType, getRewardModifiersForNodeType } from "./modifiers";
import { canDescendFromLabyrinthNode, floorNodes } from "./map-state";

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
    "corruption",
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
  return ["entrance", ...shuffle(middle, rng), "boss"];
}

function neighborSlots(positions: readonly LabyrinthGridPosition[], index: number): number[] {
  const source = positions[index];
  if (!source) return [];
  const neighbors: number[] = [];
  for (let other = 0; other < positions.length; other += 1) {
    if (other !== index && areGridNeighbors(source, positions[other]!)) neighbors.push(other);
  }
  return neighbors;
}

export function orderTypesForPositions(
  types: readonly LabyrinthNodeType[],
  positions: readonly LabyrinthGridPosition[],
  rng: () => number,
): LabyrinthNodeType[] {
  if (types.length !== positions.length) return [...types];
  const neighbors = positions.map((_, index) => neighborSlots(positions, index));
  const seated = [...types];
  const slots = shuffle(types.map((_, index) => index).slice(1, -1), rng);
  const conflicts = () =>
    neighbors.reduce(
      (sum, adjacent, index) =>
        sum + adjacent.filter((other) => other > index && seated[other] === seated[index]).length,
      0,
    );
  let best = conflicts();
  let improved = true;
  while (improved && best > 0) {
    improved = false;
    for (const [index, first] of slots.entries()) {
      for (const second of slots.slice(index + 1)) {
        if (seated[first] === seated[second]) continue;
        [seated[first], seated[second]] = [seated[second]!, seated[first]!];
        const score = conflicts();
        if (score < best) {
          best = score;
          improved = true;
        } else {
          [seated[first], seated[second]] = [seated[second], seated[first]];
        }
      }
    }
  }
  return seated;
}

function makeNode(input: {
  id: string;
  type: LabyrinthNodeType;
  floor: number;
  gridPosition: LabyrinthNode["gridPosition"];
  rng: () => number;
  enemyId?: string;
}): LabyrinthNode {
  const combatType = input.type === "combat" || input.type === "elite" || input.type === "boss" ? input.type : null;
  const node: LabyrinthNode = {
    id: input.id,
    type: input.type,
    floor: input.floor,
    gridPosition: input.gridPosition,
    modifiers: combatType
      ? getEnemyModifiersForNodeType(
          combatType,
          input.rng,
          input.enemyId ? (enemyById[input.enemyId]?.traits.map((trait) => trait.id) ?? []) : [],
        )
      : [],
    rewardModifiers: getRewardModifiersForNodeType(input.rng, input.type),
    cleared: input.type === "entrance",
  };
  if (input.enemyId) node.enemyId = input.enemyId;
  return node;
}

function generateFloorPositions(rng: () => number): LabyrinthGridPosition[] {
  const columns = Array.from({ length: LABYRINTH_GRID.columns }, (_, col) => col);
  const entrance = { row: 0, col: randomInt(0, LABYRINTH_GRID.columns - 1, rng) };
  const boss = {
    row: LABYRINTH_GRID.rows - 1,
    col: pickRandom(
      columns.filter((col) => Math.abs(col - entrance.col) >= LABYRINTH_GRID.minimumBossColumnDistance),
      rng,
    )!,
  };
  const endpoints = new Set([gridKey(entrance), gridKey(boss)]);
  const middle = labyrinthGridPositions().filter((position) => !endpoints.has(gridKey(position)));
  return [entrance, ...middle, boss];
}

function generateFloor(
  depth: number,
  rng: () => number,
  usedEnemies: ReadonlySet<string>,
): { floor: LabyrinthFloor; nodes: LabyrinthNode[]; entryId: string } {
  const positions = generateFloorPositions(rng);
  const types = plannedTypes(positions.length, rng);
  const used = new Set(usedEnemies);
  const nodes = orderTypesForPositions(types, positions, rng).map((type, index) => {
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

export function generateLabyrinthMap(rng: () => number): LabyrinthMap {
  const first = generateFloor(1, rng, new Set());
  return {
    currentFloor: 1,
    currentNodeId: first.entryId,
    floors: [first.floor],
    nodes: Object.fromEntries(first.nodes.map((node) => [node.id, node])),
  };
}

export function addLabyrinthSideRooms(map: LabyrinthMap, rng: () => number): LabyrinthMap {
  const nodes = { ...map.nodes };
  const usedEnemies = usedEnemyIds(map);
  const floors = map.floors.map((floor) => {
    const rooms = floorNodes(map, floor.depth);
    const occupied = new Set(rooms.map((node) => gridKey(node.gridPosition)));
    const usedTypes = new Set(rooms.map((node) => node.type));
    const missing = labyrinthGridPositions().filter((position) => !occupied.has(gridKey(position)));
    const added = missing.map((gridPosition) => {
      const type = pickRandom<LabyrinthNodeType>(
        ["combat", "combat", "elite", ...LABYRINTH_SUPPORT_TYPES.filter((type) => !usedTypes.has(type))],
        rng,
      )!;
      usedTypes.add(type);
      const enemyId = COMBAT_NODE_TYPES.has(type)
        ? pickEnemyId(type === "elite" ? "elite" : "normal", usedEnemies, rng)
        : undefined;
      if (enemyId) usedEnemies.add(enemyId);
      const node = makeNode({
        id: `${floor.id}-side-${gridPosition.row}-${gridPosition.col}`,
        type,
        floor: floor.depth,
        gridPosition,
        rng,
        ...(enemyId ? { enemyId } : {}),
      });
      nodes[node.id] = node;
      return node.id;
    });
    return added.length ? { ...floor, nodeIds: [...floor.nodeIds, ...added] } : floor;
  });
  return { ...map, floors, nodes };
}

export function expandBeyondBoss(map: LabyrinthMap, bossId: string, rng: () => number): LabyrinthMap {
  if (!canDescendFromLabyrinthNode(map, bossId)) return map;

  const depth = map.currentFloor + 1;
  const nextFloor = map.floors.find((floor) => floor.depth === depth);
  if (nextFloor) {
    const entrance = floorNodes(map, depth).find((node) => node.type === "entrance");
    return entrance ? { ...map, currentFloor: depth, currentNodeId: entrance.id } : map;
  }

  const generated = generateFloor(depth, rng, usedEnemyIds(map));
  return {
    ...map,
    floors: [...map.floors, generated.floor],
    nodes: { ...map.nodes, ...Object.fromEntries(generated.nodes.map((node) => [node.id, node])) },
    currentFloor: depth,
    currentNodeId: generated.entryId,
  };
}
