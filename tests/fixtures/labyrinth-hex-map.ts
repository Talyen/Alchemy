/** Deterministic hex Labyrinth map for save fixtures and E2E inject. Keep this module free of game-data art imports. */
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
