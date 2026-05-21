import { describe, expect, it } from "vitest";
import { normalizeActiveRun } from "@/features/alchemy/storage/active-run";
import { defaultBattleState } from "@/lib/battle";

function makeRunCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    characterId: "knight",
    runDeck: [{ id: "slash", title: "Slash", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 4 }], uid: 1 }],
    runGold: 10,
    runPlayerHealth: 25,
    runMaxHealth: 30,
    roomsEncountered: 2,
    currentAct: 1,
    destinationIndexInAct: 1,
    completedDestinations: ["combat"],
    runTrinkets: [],
    selectedDifficulty: "difficulty-1",
    contentSystemType: "campaign",
    ...overrides,
  };
}

describe("normalizeActiveRun", () => {
  it("returns null for null input", () => {
    expect(normalizeActiveRun(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeActiveRun(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeActiveRun("bad")).toBeNull();
  });

  it("returns null when characterId is missing", () => {
    const data = makeRunCandidate();
    delete data.characterId;
    expect(normalizeActiveRun(data)).toBeNull();
  });

  it("returns null when characterId is invalid", () => {
    expect(normalizeActiveRun(makeRunCandidate({ characterId: "invalid-char" }))).toBeNull();
  });

  it("remaps legacy characterId 'sorcerer' to 'wizard'", () => {
    const result = normalizeActiveRun(makeRunCandidate({ characterId: "sorcerer" }));
    expect(result?.characterId).toBe("wizard");
  });

  it("remaps legacy characterId 'warden' to 'ranger'", () => {
    const result = normalizeActiveRun(makeRunCandidate({ characterId: "warden" }));
    expect(result?.characterId).toBe("ranger");
  });

  it("returns null when run shape is missing required fields", () => {
    const data = makeRunCandidate();
    delete data.runDeck;
    expect(normalizeActiveRun(data)).toBeNull();
  });

  it("returns null when runGold is negative", () => {
    expect(normalizeActiveRun(makeRunCandidate({ runGold: -5 }))).toBeNull();
  });

  it("returns null when runGold is NaN", () => {
    expect(normalizeActiveRun(makeRunCandidate({ runGold: NaN }))).toBeNull();
  });

  it("returns null when runGold is a float", () => {
    expect(normalizeActiveRun(makeRunCandidate({ runGold: 5.5 }))).toBeNull();
  });

  it("returns null when playerHealth exceeds maxHealth", () => {
    expect(normalizeActiveRun(makeRunCandidate({ runPlayerHealth: 40, runMaxHealth: 30 }))).toBeNull();
  });

  it("returns null when playerHealth is negative", () => {
    expect(normalizeActiveRun(makeRunCandidate({ runPlayerHealth: -1, runMaxHealth: 30 }))).toBeNull();
  });

  it("returns null when maxHealth is 0", () => {
    expect(normalizeActiveRun(makeRunCandidate({ runPlayerHealth: 0, runMaxHealth: 0 }))).toBeNull();
  });

  it("returns null when currentAct is less than 1", () => {
    expect(normalizeActiveRun(makeRunCandidate({ currentAct: 0 }))).toBeNull();
  });

  it("returns null when currentAct exceeds max acts", () => {
    expect(normalizeActiveRun(makeRunCandidate({ currentAct: 99 }))).toBeNull();
  });

  it("parses a valid campaign run with all fields", () => {
    const result = normalizeActiveRun(makeRunCandidate());
    expect(result).not.toBeNull();
    expect(result!.characterId).toBe("knight");
    expect(result!.runGold).toBe(10);
    expect(result!.runPlayerHealth).toBe(25);
    expect(result!.runMaxHealth).toBe(30);
    expect(result!.roomsEncountered).toBe(2);
    expect(result!.currentAct).toBe(1);
    expect(result!.contentSystemType).toBe("campaign");
    expect(result!.selectedDifficulty).toBe("difficulty-1");
    expect(result!.encounteredRunEnemyIds).toEqual([]);
    expect(result!.labyrinthMap).toBeNull();
    expect(result!.activeCombat).toBeNull();
  });

  it("normalizes encountered run enemy IDs", () => {
    const result = normalizeActiveRun(makeRunCandidate({ encounteredRunEnemyIds: ["goblin", "goblin", 7] }));

    expect(result).not.toBeNull();
    expect(result!.encounteredRunEnemyIds).toEqual(["goblin"]);
  });

  it("uses class starting deck when runDeck matches legacy starter deck IDs", () => {
    const result = normalizeActiveRun(makeRunCandidate({
      characterId: "ranger",
      runDeck: [
        { id: "slash", title: "Slash", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "bash", title: "Bash", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "block", title: "Block", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "anvil", title: "Anvil", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "plate-mail", title: "Plate Mail", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "apple", title: "Apple", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "meteor", title: "Meteor", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "blessed-aegis", title: "Blessed Aegis", descriptionLines: [""], art: "", cost: 1, effects: [] },
      ],
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
    }));
    expect(result).not.toBeNull();
    expect(result!.runDeck.length).toBe(9); // ranger default
  });

  it("hydrates saved cards with library data", () => {
    const result = normalizeActiveRun(makeRunCandidate({
      runDeck: [{
        id: "slash",
        uid: 42,
        cost: 2,
        consume: true,
        corrupted: true,
        baseTitle: "Corrupted Slash",
      }],
    }));
    expect(result).not.toBeNull();
    const card = result!.runDeck[0];
    expect(card.id).toBe("slash");
    expect(card.uid).toBe(42);
    expect(card.title).toBeDefined();
    expect(card.descriptionLines.length).toBeGreaterThan(0);
  });

  it("uses class deck when runDeck is empty and run is unstarted", () => {
    const result = normalizeActiveRun(makeRunCandidate({
      runDeck: [],
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
    }));
    expect(result).not.toBeNull();
    expect(result!.runDeck.length).toBe(8); // knight default
  });

  it("sets contentSystemType to 'campaign' for unknown types", () => {
    const result = normalizeActiveRun(makeRunCandidate({ contentSystemType: "wildwood" }));
    expect(result!.contentSystemType).toBe("campaign");
  });

  it("sets labyrinth type for labyrinth runs", () => {
    const result = normalizeActiveRun(makeRunCandidate({ contentSystemType: "labyrinth" }));
    expect(result!.contentSystemType).toBe("labyrinth");
  });

  it("normalizes valid active combat data", () => {
    const battleState = { ...defaultBattleState(), turn: 2, playerHealth: 11 };
    const result = normalizeActiveRun(makeRunCandidate({ activeCombat: { battleState } }));

    expect(result!.activeCombat?.battleState.turn).toBe(2);
    expect(result!.activeCombat?.battleState.playerHealth).toBe(11);
    expect(result!.labyrinthPendingNode).toBeNull();
  });

  it("drops invalid active combat data", () => {
    const result = normalizeActiveRun(makeRunCandidate({ activeCombat: { battleState: { turn: 2 } } }));

    expect(result!.activeCombat).toBeNull();
  });
});

describe("normalizeActiveRun with labyrinth map", () => {
  // A minimal valid 1x2 grid: entrance(0,0) → boss(0,1)
  const valid1x2Grid = [
    [
      { type: "entrance", state: "current", connections: [{ row: 0, col: 1 }], modifiers: [], rewardModifiers: [] },
      { type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] },
    ],
  ];

  function makeLabyrinthRun(labyrinthMap: Record<string, unknown>) {
    return makeRunCandidate({
      contentSystemType: "labyrinth",
      labyrinthMap,
    });
  }

  it("parses a valid labyrinth map", () => {
    const result = normalizeActiveRun(makeLabyrinthRun({
      rows: 1, cols: 2, currentNode: { row: 0, col: 0 }, grid: valid1x2Grid,
    }));
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).not.toBeNull();
    expect(result!.labyrinthMap!.rows).toBe(1);
    expect(result!.labyrinthMap!.cols).toBe(2);
  });

  it("sets labyrinthMap to null when grid dimension mismatches rows", () => {
    const result = normalizeActiveRun(makeLabyrinthRun({
      rows: 2, cols: 2, currentNode: { row: 0, col: 0 }, grid: valid1x2Grid,
    }));
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).toBeNull();
  });

  it("sets labyrinthMap to null when map has no entrance", () => {
    const result = normalizeActiveRun(makeLabyrinthRun({
      rows: 1, cols: 2, currentNode: { row: 0, col: 0 }, grid: [
        [
          { type: "combat", state: "current", connections: [{ row: 0, col: 1 }], modifiers: [], rewardModifiers: [] },
          { type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] },
        ],
      ],
    }));
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).toBeNull();
  });

  it("sets labyrinthMap to null when currentNode is out of bounds", () => {
    const result = normalizeActiveRun(makeLabyrinthRun({
      rows: 1, cols: 2, currentNode: { row: 99, col: 0 }, grid: valid1x2Grid,
    }));
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).toBeNull();
  });

  it("sets labyrinthMap to null when a node has 0 connections", () => {
    const result = normalizeActiveRun(makeLabyrinthRun({
      rows: 1, cols: 2, currentNode: { row: 0, col: 0 }, grid: [
        [
          { type: "entrance", state: "current", connections: [], modifiers: [], rewardModifiers: [] },
          { type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] },
        ],
      ],
    }));
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).toBeNull();
  });

  it("sets labyrinthMap to null when connections are non-adjacent (dr=2)", () => {
    const result = normalizeActiveRun(makeLabyrinthRun({
      rows: 3, cols: 1, currentNode: { row: 0, col: 0 }, grid: [
        [{ type: "entrance", state: "current", connections: [{ row: 2, col: 0 }], modifiers: [], rewardModifiers: [] }],
        [{ type: "combat", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] }],
        [{ type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] }],
      ],
    }));
    // entrance(0,0)→boss(2,0) is non-adjacent (dr=2)
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).toBeNull();
  });

  it("filters unknown labyrinth modifier kinds", () => {
    const result = normalizeActiveRun(makeLabyrinthRun({
      rows: 1, cols: 2, currentNode: { row: 0, col: 0 }, grid: [
        [
          { type: "entrance", state: "current", connections: [{ row: 0, col: 1 }], modifiers: ["unknown-mod"], rewardModifiers: [] },
          { type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] },
        ],
      ],
    }));
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).not.toBeNull();
    expect(result!.labyrinthMap!.grid[0][0]!.modifiers).toEqual([]);
  });

  it("normalizes labyrinth combat pending node and modifiers", () => {
    const result = normalizeActiveRun(makeRunCandidate({
      contentSystemType: "labyrinth",
      labyrinthMap: { rows: 1, cols: 2, currentNode: { row: 0, col: 0 }, grid: valid1x2Grid },
      labyrinthPendingNode: { row: 0, col: 1 },
      activeCombat: {
        battleState: defaultBattleState(),
        activeLabyrinthModifiers: ["armored", "unknown"],
        activeLabyrinthRewardModifiers: ["generous"],
      },
    }));

    expect(result!.labyrinthPendingNode).toEqual({ row: 0, col: 1 });
    expect(result!.activeCombat?.activeLabyrinthModifiers).toEqual(["armored"]);
    expect(result!.activeCombat?.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });
});

describe("labyrinth map normalization (direct)", () => {
  it("sets labyrinthMap to null for non-object labyrinthMap", () => {
    const data = makeRunCandidate({ contentSystemType: "labyrinth", labyrinthMap: "bad" });
    const result = normalizeActiveRun(data);
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).toBeNull();
  });

  it("sets labyrinthMap to null for labyrinthMap with non-array grid", () => {
    const data = makeRunCandidate({ contentSystemType: "labyrinth", labyrinthMap: { grid: "bad" } });
    const result = normalizeActiveRun(data);
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).toBeNull();
  });
});
