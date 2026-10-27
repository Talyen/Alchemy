import { isLootEligible } from "@/lib/loot";
import { pickRandom, rngInt, shuffle } from "@/lib/rng";
import { enemiesByType, enemyById, type BattleCard, type EnemyType } from "@/lib/game-data";

import type { LabyrinthFloor, LabyrinthGridPosition, LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "../types";
import { LABYRINTH_SUPPORT_TYPES, labyrinthFloorId, labyrinthNodeId } from "./data";
import { LABYRINTH_GRID, gridKey, labyrinthGridPositions, neighboringGridKeys } from "./grid";
import { getEnemyModifiersForNodeType, getRewardModifiersForNodeType } from "./modifiers";
import { canDescendFromLabyrinthNode, floorNodes } from "./map-state";

export { canEnterLabyrinthNode } from "./map-state";

const COMBAT_NODE_TYPES = new Set<LabyrinthNodeType>(["combat", "elite", "boss"]);

function usedEnemyIds(map: LabyrinthMap): Set<string> {
  return new Set(Object.values(map.nodes).flatMap((node) => (node.enemyId ? [node.enemyId] : [])));
}

function pickEnemyId(type: EnemyType, used: ReadonlySet<string>, rng: () => number): string | undefined {
  const pool = enemiesByType[type];
  const preferred = pool.filter((enemy) => !used.has(enemy.id));
  const candidates = preferred.length > 0 ? preferred : pool;
  return pickRandom(candidates, rng)?.id;
}

function availableNodeType(type: LabyrinthNodeType, lootDepth: number): LabyrinthNodeType {
  return type === "trinket-shop" && !isLootEligible("trinket", lootDepth) ? "equipment-shop" : type;
}

function plannedTypes(count: number, rng: () => number, lootDepth: number): LabyrinthNodeType[] {
  const eligibleSupports = LABYRINTH_SUPPORT_TYPES.filter(
    (type) => type !== "trinket-shop" || isLootEligible("trinket", lootDepth),
  );
  const support = shuffle([...eligibleSupports], rng);
  const middle: LabyrinthNodeType[] = support.slice(0, Math.min(3, count - 2));
  const weighted: LabyrinthNodeType[] = [
    "combat",
    "combat",
    "elite",
    "mystery",
    "rest",
    "corruption",
    "transmutation",
    "shop",
    "alchemist",
    "trinket-shop",
    "equipment-shop",
  ];
  while (middle.length < count - 2) {
    const next = availableNodeType(pickRandom(weighted, rng) ?? "combat", lootDepth);
    if (LABYRINTH_SUPPORT_TYPES.includes(next as (typeof LABYRINTH_SUPPORT_TYPES)[number]) && middle.includes(next)) {
      middle.push("combat");
    } else {
      middle.push(next);
    }
  }
  return ["entrance", ...shuffle(middle, rng), "boss"];
}

export function orderTypesForPositions(
  types: readonly LabyrinthNodeType[],
  positions: readonly LabyrinthGridPosition[],
  rng: () => number,
): LabyrinthNodeType[] {
  if (types.length !== positions.length) return [...types];
  const indexByKey = new Map(positions.map((position, index) => [gridKey(position), index]));
  const neighbors = positions.map((position) => {
    const list: number[] = [];
    for (const key of neighboringGridKeys(position)) {
      const neighbor = indexByKey.get(key);
      if (neighbor !== undefined) list.push(neighbor);
    }
    return list;
  });
  const seated = [...types];
  const slots = shuffle(types.map((_, index) => index).slice(1, -1), rng);
  function conflictsAt(index: number): number {
    let count = 0;
    for (const other of neighbors[index] ?? []) {
      if (seated[other] === seated[index]) count += 1;
    }
    return count;
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let index = 0; index < slots.length; index += 1) {
      const first = slots[index]!;
      for (let next = index + 1; next < slots.length; next += 1) {
        const second = slots[next]!;
        if (seated[first] === seated[second]) continue;
        const firstType = seated[first];
        const secondType = seated[second];
        if (firstType === undefined || secondType === undefined) continue;
        const before = conflictsAt(first) + conflictsAt(second);
        seated[first] = secondType;
        seated[second] = firstType;
        if (conflictsAt(first) + conflictsAt(second) < before) {
          improved = true;
        } else {
          seated[first] = firstType;
          seated[second] = secondType;
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
  lootDepth: number;
  deck?: readonly BattleCard[];
}): LabyrinthNode {
  const type = availableNodeType(input.type, input.lootDepth);
  const combatType = type === "combat" || type === "elite" || type === "boss" ? type : null;
  const node: LabyrinthNode = {
    id: input.id,
    type,
    floor: input.floor,
    gridPosition: input.gridPosition,
    modifiers: combatType
      ? getEnemyModifiersForNodeType(
          combatType,
          input.rng,
          input.enemyId ? (enemyById[input.enemyId]?.traits.map((trait) => trait.id) ?? []) : [],
        )
      : [],
    rewardModifiers: getRewardModifiersForNodeType(input.rng, type, input.lootDepth, input.deck),
    cleared: type === "entrance",
  };
  if (input.enemyId) node.enemyId = input.enemyId;
  return node;
}

function generateFloorPositions(rng: () => number): LabyrinthGridPosition[] {
  const columns = Array.from({ length: LABYRINTH_GRID.columns }, (_, col) => col);
  const entrance = { row: 0, col: rngInt(rng, LABYRINTH_GRID.columns) };
  const eligibleColumns = columns.filter(
    (col) => Math.abs(col - entrance.col) >= LABYRINTH_GRID.minimumBossColumnDistance,
  );
  const boss = {
    row: LABYRINTH_GRID.rows - 1,
    col: pickRandom(eligibleColumns, rng) ?? 0,
  };
  const endpoints = new Set([gridKey(entrance), gridKey(boss)]);
  const middle = labyrinthGridPositions().filter((position) => !endpoints.has(gridKey(position)));
  return [entrance, ...middle, boss];
}

function generateFloor(
  depth: number,
  rng: () => number,
  usedEnemies: ReadonlySet<string>,
  completedRooms = 0,
  deck?: readonly BattleCard[],
): { floor: LabyrinthFloor; nodes: LabyrinthNode[]; entryId: string } {
  const positions = generateFloorPositions(rng);
  const origin = positions[0] ?? { row: 0, col: 0 };
  const lootDepthAt = (position: LabyrinthGridPosition) =>
    completedRooms + Math.abs(position.row - origin.row) + Math.abs(position.col - origin.col);
  const roomPositions = positions.slice(1, -1);
  const types = orderTypesForPositions(
    plannedTypes(positions.length, rng, Math.max(...roomPositions.map(lootDepthAt))),
    positions,
    rng,
  );
  const trinketShopIndex = types.indexOf("trinket-shop");
  if (trinketShopIndex >= 0 && !isLootEligible("trinket", lootDepthAt(positions[trinketShopIndex]!))) {
    const eligibleSlots = positions.flatMap((position, index) =>
      index > 0 && index < positions.length - 1 && isLootEligible("trinket", lootDepthAt(position)) ? [index] : [],
    );
    const slot = pickRandom(eligibleSlots, rng);
    if (slot !== undefined) [types[trinketShopIndex], types[slot]] = [types[slot]!, types[trinketShopIndex]!];
    else types[trinketShopIndex] = "equipment-shop";
  }
  const used = new Set(usedEnemies);
  const nodes = types.map((type, index) => {
    const enemyType: EnemyType = type === "boss" ? "boss" : type === "elite" ? "elite" : "normal";
    const enemyId = COMBAT_NODE_TYPES.has(type) ? pickEnemyId(enemyType, used, rng) : undefined;
    if (enemyId) used.add(enemyId);
    const gridPos = positions[index] ?? origin;
    return makeNode({
      id: labyrinthNodeId(depth, index),
      type,
      floor: depth,
      gridPosition: gridPos,
      lootDepth: lootDepthAt(gridPos),
      rng,
      ...(deck ? { deck } : {}),
      ...(enemyId ? { enemyId } : {}),
    });
  });
  const entryId = nodes[0]?.id ?? labyrinthNodeId(depth, 0);
  return {
    floor: { id: labyrinthFloorId(depth), depth, nodeIds: nodes.map((node) => node.id) },
    nodes,
    entryId,
  };
}

export function generateLabyrinthMap(rng: () => number, deck?: readonly BattleCard[]): LabyrinthMap {
  const first = generateFloor(1, rng, new Set(), 0, deck);
  return {
    currentFloor: 1,
    currentNodeId: first.entryId,
    floors: [first.floor],
    nodes: Object.fromEntries(first.nodes.map((node) => [node.id, node])),
  };
}

export function expandBeyondBoss(
  map: LabyrinthMap,
  bossId: string,
  rng: () => number,
  deck?: readonly BattleCard[],
): LabyrinthMap {
  if (!canDescendFromLabyrinthNode(map, bossId)) return map;

  const depth = map.currentFloor + 1;
  const nextFloor = map.floors.find((floor) => floor.depth === depth);
  if (nextFloor) {
    const entrance = floorNodes(map, depth).find((node) => node.type === "entrance");
    return entrance ? { ...map, currentFloor: depth, currentNodeId: entrance.id } : map;
  }

  const generated = generateFloor(
    depth,
    rng,
    usedEnemyIds(map),
    Object.values(map.nodes).filter((node) => node.cleared && node.type !== "entrance").length,
    deck,
  );
  return {
    ...map,
    floors: [...map.floors, generated.floor],
    nodes: { ...map.nodes, ...Object.fromEntries(generated.nodes.map((node) => [node.id, node])) },
    currentFloor: depth,
    currentNodeId: generated.entryId,
  };
}
