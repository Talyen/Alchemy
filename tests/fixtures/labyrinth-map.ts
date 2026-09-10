import { labyrinthFloorId, labyrinthNodeId } from "@/lib/content-systems/labyrinth/data";
import { LABYRINTH_GRID } from "@/lib/content-systems/labyrinth/grid";
import type { LabyrinthMap, LabyrinthNode, LabyrinthNodeType } from "@/lib/content-systems/types";

const ROOM_TYPES: LabyrinthNodeType[] = [
  "combat",
  "shop",
  "elite",
  "rest",
  "combat",
  "mystery",
  "alchemist",
  "corruption",
  "combat",
  "trinket-shop",
  "combat",
  "equipment-shop",
  "elite",
  "combat",
  "boss",
];

function floorNodes(depth: number): LabyrinthNode[] {
  const entrance: LabyrinthNode = {
    id: `${labyrinthFloorId(depth)}-entrance`,
    type: "entrance",
    floor: depth,
    gridPosition: { row: 0, col: 0 },
    modifiers: [],
    rewardModifiers: [],
    cleared: true,
  };
  return [
    entrance,
    ...ROOM_TYPES.map((type, index): LabyrinthNode => {
      const enemyId = type === "boss" ? "forge-golem" : type === "combat" || type === "elite" ? "goblin" : undefined;
      return {
        id: labyrinthNodeId(depth, index),
        type,
        floor: depth,
        gridPosition: {
          row: Math.floor((index + 1) / LABYRINTH_GRID.columns),
          col: (index + 1) % LABYRINTH_GRID.columns,
        },
        modifiers: [],
        rewardModifiers: [],
        cleared: false,
        ...(enemyId ? { enemyId } : {}),
      };
    }),
    ...[1, 2].flatMap((row) =>
      [-1, LABYRINTH_GRID.columns].map(
        (col): LabyrinthNode => ({
          id: `${labyrinthFloorId(depth)}-side-${row}-${col}`,
          type: "combat",
          floor: depth,
          gridPosition: { row, col },
          modifiers: [],
          rewardModifiers: [],
          cleared: false,
          enemyId: "bandit",
        }),
      ),
    ),
  ];
}

export function gridLabyrinthMapFixture(): LabyrinthMap {
  const nodes = floorNodes(1);
  return {
    currentFloor: 1,
    currentNodeId: nodes[0]!.id,
    floors: [{ id: labyrinthFloorId(1), depth: 1, nodeIds: nodes.map((node) => node.id) }],
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}

export function twoFloorLabyrinthMapFixture(): LabyrinthMap {
  const map = gridLabyrinthMapFixture();
  for (const node of Object.values(map.nodes)) node.cleared = true;
  const second = floorNodes(2);
  return {
    currentFloor: 2,
    currentNodeId: second[0]!.id,
    floors: [...map.floors, { id: labyrinthFloorId(2), depth: 2, nodeIds: second.map((node) => node.id) }],
    nodes: { ...map.nodes, ...Object.fromEntries(second.map((node) => [node.id, node])) },
  };
}
