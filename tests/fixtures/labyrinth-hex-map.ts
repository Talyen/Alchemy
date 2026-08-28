import {
  LABYRINTH_ENTRANCE_FLOOR_ID,
  LABYRINTH_ENTRANCE_NODE_ID,
  labyrinthFloorId,
  labyrinthNodeId,
} from "@/lib/content-systems/labyrinth/data";
import { generateFloorLayout } from "@/lib/content-systems/labyrinth/hex-layout";
import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "@/lib/content-systems/types";

export function hexLabyrinthMapFixture() {
  const combatId = "labyrinth-floor-1-n0";
  const restId = "labyrinth-floor-1-n1";
  const bossId = "labyrinth-floor-1-n2";
  const entranceId = "labyrinth-entrance";
  return {
    currentFloor: 1,
    floors: [
      { id: "labyrinth-floor-0", depth: 0, nodeIds: [entranceId] },
      { id: "labyrinth-floor-1", depth: 1, nodeIds: [combatId, restId, bossId] },
    ],
    nodes: {
      [entranceId]: {
        id: entranceId,
        type: "entrance" as const,
        floor: 0,
        gridPosition: { row: 0, col: 0 },
        modifiers: [],
        rewardModifiers: [],
        outgoingIds: [combatId],
        cleared: true,
      },
      [combatId]: {
        id: combatId,
        type: "combat" as const,
        floor: 1,
        gridPosition: { row: 0, col: 0 },
        modifiers: [],
        rewardModifiers: [],
        outgoingIds: [],
        cleared: false,
        enemyId: "goblin",
      },
      [restId]: {
        id: restId,
        type: "rest" as const,
        floor: 1,
        gridPosition: { row: 1, col: 0 },
        modifiers: [],
        rewardModifiers: [],
        outgoingIds: [],
        cleared: false,
      },
      [bossId]: {
        id: bossId,
        type: "boss" as const,
        floor: 1,
        gridPosition: { row: 2, col: 0 },
        modifiers: [],
        rewardModifiers: [],
        outgoingIds: [],
        cleared: false,
        enemyId: "forge-golem",
      },
    },
  };
}

const PRODUCTION_FLOOR_SIZE = 12;
const PRODUCTION_FLOOR_TYPES: LabyrinthNodeType[] = [
  "combat",
  "combat",
  "rest",
  "elite",
  "mystery",
  "shop",
  "combat",
  "alchemist",
  "rest",
  "trinket-shop",
  "elite",
  "boss",
];

function combatEnemyId(type: LabyrinthNodeType): string | undefined {
  if (type === "boss") return "forge-golem";
  if (type === "combat" || type === "elite") return "goblin";
  return undefined;
}

function playableFloorNodes(
  depth: number,
  cleared: (index: number, type: LabyrinthNodeType) => boolean,
): LabyrinthNode[] {
  const positions = generateFloorLayout(PRODUCTION_FLOOR_SIZE, () => 0);
  return PRODUCTION_FLOOR_TYPES.map((type, index) => {
    const node: LabyrinthNode = {
      id: labyrinthNodeId(depth, index),
      type,
      floor: depth,
      gridPosition: positions[index]!,
      modifiers: [],
      rewardModifiers: [],
      outgoingIds: [],
      cleared: cleared(index, type),
    };
    const enemyId = combatEnemyId(type);
    if (enemyId) node.enemyId = enemyId;
    return node;
  });
}

export function productionHexLabyrinthMapFixture(): LabyrinthMap {
  const floor1 = playableFloorNodes(1, (index, type) => index < 5 || type === "boss");
  const floor2 = playableFloorNodes(2, () => false);
  const floor1Linked = floor1.map((node, index) =>
    index === floor1.length - 1 ? { ...node, outgoingIds: [floor2[0]!.id] } : node,
  );
  const entrance: LabyrinthNode = {
    id: LABYRINTH_ENTRANCE_NODE_ID,
    type: "entrance",
    floor: 0,
    gridPosition: { row: 0, col: 0 },
    modifiers: [],
    rewardModifiers: [],
    outgoingIds: [floor1Linked[0]!.id],
    cleared: true,
  };
  const nodes = [entrance, ...floor1Linked, ...floor2];
  return {
    currentFloor: 2,
    floors: [
      { id: LABYRINTH_ENTRANCE_FLOOR_ID, depth: 0, nodeIds: [entrance.id] },
      { id: labyrinthFloorId(1), depth: 1, nodeIds: floor1Linked.map((node) => node.id) },
      { id: labyrinthFloorId(2), depth: 2, nodeIds: floor2.map((node) => node.id) },
    ],
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}
