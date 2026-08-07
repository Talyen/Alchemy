import { describe, expect, it } from "vitest";
import { parseActiveRun } from "@/lib/active-run-session";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";
import { defaultBattleState, repairPersistedBattleTrinketManifest } from "@/lib/battle";
import { cardLibrary } from "@/lib/game-data";
import { makeRunCandidate } from "../../../../fixtures/active-run";

describe("parseActiveRun", () => {
  it("returns null for null input", () => {
    expect(parseActiveRun(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseActiveRun(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseActiveRun("bad")).toBeNull();
  });

  it("returns null when characterId is missing", () => {
    const data = makeRunCandidate();
    delete data.characterId;
    expect(parseActiveRun(data)).toBeNull();
  });

  it("returns null when characterId is invalid", () => {
    expect(parseActiveRun(makeRunCandidate({ characterId: "invalid-char" }))).toBeNull();
  });

  it("rejects retired characterId aliases", () => {
    expect(parseActiveRun(makeRunCandidate({ characterId: "sorcerer" }))).toBeNull();
    expect(parseActiveRun(makeRunCandidate({ characterId: "warden" }))).toBeNull();
  });

  it("returns null when run shape is missing required fields", () => {
    const data = makeRunCandidate();
    delete data.runDeck;
    expect(parseActiveRun(data)).toBeNull();
  });

  it("parses a valid campaign run with all fields", () => {
    const result = parseActiveRun(makeRunCandidate());
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
    const result = parseActiveRun(makeRunCandidate({ encounteredRunEnemyIds: ["goblin", "goblin", 7] }));

    expect(result).not.toBeNull();
    expect(result!.encounteredRunEnemyIds).toEqual(["goblin"]);
  });

  it("accepts a full 8-card runDeck for ranger", () => {
    const result = parseActiveRun(
      makeRunCandidate({
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
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.runDeck.length).toBe(8);
  });

  it("hydrates saved cards with library data", () => {
    const result = parseActiveRun(
      makeRunCandidate({
        runDeck: [
          {
            id: "slash",
            uid: 42,
            cost: 2,
            consume: true,
            corrupted: true,
            baseTitle: "Corrupted Slash",
          },
        ],
      }),
    );
    expect(result).not.toBeNull();
    const card = result!.runDeck[0];
    expect(card.id).toBe("slash");
    expect(card.uid).toBe(42);
    expect(card.title).toBe(cardLibrary.find((entry) => entry.id === "slash")?.title);
    expect(card.descriptionLines.length).toBeGreaterThan(0);
  });

  it("preserves empty runDeck array for unstarted run without deck synthesis", () => {
    const result = parseActiveRun(
      makeRunCandidate({
        runDeck: [],
        roomsEncountered: 0,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.runDeck.length).toBe(0);
  });

  it("discards wildwood runs without Wildwood Draft state", () => {
    const result = parseActiveRun(makeRunCandidate({ contentSystemType: "wildwood" }));
    expect(result).toBeNull();
  });

  it("parses resumable Wildwood Draft state", () => {
    const wildwoodDraft = {
      version: 3 as const,
      phase: "draft" as const,
      draftChoices: makeRunCandidate().runDeck,
      remainingBossIds: ["forge-golem", "iron-bear"] as const,
      previousBossId: null,
      currentBossId: null,
      currentCombatTraitIds: [],
      currentRewardTraitIds: [],
      rewardType: null,
      rewardChoiceIds: [],
      rewardGearChoices: [],
      selectedRewardId: null,
    };

    const result = parseActiveRun(
      makeRunCandidate({
        contentSystemType: "wildwood",
        selectedDifficulty: null,
        wildwoodDraft,
      }),
    );

    expect(result?.contentSystemType).toBe("wildwood");
    expect(result?.wildwoodDraft).toMatchObject({ phase: "draft", remainingBossIds: ["forge-golem", "iron-bear"] });
  });

  it("drops removed Wildwood trait ids without invalidating the run", () => {
    const result = parseActiveRun(
      makeRunCandidate({
        contentSystemType: "wildwood",
        selectedDifficulty: null,
        wildwoodDraft: {
          version: 3 as const,
          phase: "battle" as const,
          draftChoices: [],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: "forge-golem" as const,
          currentCombatTraitIds: ["tempered", "removed-combat-trait"],
          currentRewardTraitIds: ["collector", "removed-reward-trait"],
          rewardType: null,
          rewardChoiceIds: [],
          rewardGearChoices: [],
          selectedRewardId: null,
        },
      }),
    );

    expect(result?.wildwoodDraft?.currentCombatTraitIds).toEqual(["tempered"]);
    expect(result?.wildwoodDraft?.currentRewardTraitIds).toEqual([]);
  });

  it("drops labyrinth runs when labyrinth map is missing", () => {
    const result = parseActiveRun(makeRunCandidate({ contentSystemType: "labyrinth" }));
    expect(result).toBeNull();
  });

  it("normalizes valid active combat data", () => {
    const battleState = { ...defaultBattleState(), turn: 2, playerHealth: 11 };
    const result = parseActiveRun(makeRunCandidate({ activeCombat: { battleState } }));

    expect(result!.activeCombat?.battleState.turn).toBe(2);
    expect(result!.activeCombat?.battleState.playerHealth).toBe(11);
    expect(result!.labyrinthPendingNode).toBeNull();
  });

  it("reconciles default trinketEffects from runTrinkets on resume", () => {
    const battleState = defaultBattleState();
    const legacyBattleState = { ...battleState };
    delete (legacyBattleState as { trinketEffects?: unknown }).trinketEffects;

    const migrated = normalizeSaveData({
      saveSchemaVersion: 3,
      activeRun: {
        ...makeRunCandidate({
          runTrinkets: ["bone-charm"],
          activeCombat: { battleState: legacyBattleState },
        }),
      },
    });

    const parsedBattle = migrated.activeRun?.activeCombat?.battleState;
    expect(parsedBattle).toBeTruthy();
    // Wire parse keeps structural defaults; resume repair recomputes from runTrinkets.
    expect(parsedBattle!.trinketEffects.boneCharmHealOnKill).toBe(0);
    expect(
      repairPersistedBattleTrinketManifest(parsedBattle!, migrated.activeRun!.runTrinkets).trinketEffects
        .boneCharmHealOnKill,
    ).toBe(3);
  });

  it("normalizes nested battle defaults and removes retired encounter traits", () => {
    const battleState = defaultBattleState();
    const legacyBattleState = {
      ...battleState,
      flags: { goldOnFirstPoisonThisCombat: false },
      currentEnemy: {
        ...battleState.currentEnemy,
        traits: [
          { id: "regeneration", title: "Regeneration", description: "Base enemy trait" },
          { id: "armored", title: "Armored", description: "Retired encounter trait" },
          { id: "tempered", title: "Tempered", description: "Current encounter trait" },
        ],
      },
    };

    const result = parseActiveRun(makeRunCandidate({ activeCombat: { battleState: legacyBattleState } }));

    expect(result!.activeCombat?.battleState.flags.divineAegisTriggered).toBe(false);
    expect(result!.activeCombat?.battleState.currentEnemy.traits.map((trait) => trait.id)).toEqual([
      "regeneration",
      "tempered",
    ]);
  });

  it("drops invalid active combat data", () => {
    const result = parseActiveRun(makeRunCandidate({ activeCombat: { battleState: { turn: 2 } } }));

    expect(result!.activeCombat).toBeNull();
  });
});

describe("parseActiveRun with labyrinth map", () => {
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
    const result = parseActiveRun(
      makeLabyrinthRun({
        rows: 1,
        cols: 2,
        currentNode: { row: 0, col: 0 },
        grid: valid1x2Grid,
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).not.toBeNull();
    expect(result!.labyrinthMap!.rows).toBe(1);
    expect(result!.labyrinthMap!.cols).toBe(2);
  });

  it("drops labyrinth runs when grid dimension mismatches rows", () => {
    const result = parseActiveRun(
      makeLabyrinthRun({
        rows: 2,
        cols: 2,
        currentNode: { row: 0, col: 0 },
        grid: valid1x2Grid,
      }),
    );
    expect(result).toBeNull();
  });

  it("drops labyrinth runs when map has no entrance", () => {
    const result = parseActiveRun(
      makeLabyrinthRun({
        rows: 1,
        cols: 2,
        currentNode: { row: 0, col: 0 },
        grid: [
          [
            { type: "combat", state: "current", connections: [{ row: 0, col: 1 }], modifiers: [], rewardModifiers: [] },
            { type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] },
          ],
        ],
      }),
    );
    expect(result).toBeNull();
  });

  it("drops labyrinth runs when currentNode is out of bounds", () => {
    const result = parseActiveRun(
      makeLabyrinthRun({
        rows: 1,
        cols: 2,
        currentNode: { row: 99, col: 0 },
        grid: valid1x2Grid,
      }),
    );
    expect(result).toBeNull();
  });

  it("drops labyrinth runs when a node has 0 connections", () => {
    const result = parseActiveRun(
      makeLabyrinthRun({
        rows: 1,
        cols: 2,
        currentNode: { row: 0, col: 0 },
        grid: [
          [
            { type: "entrance", state: "current", connections: [], modifiers: [], rewardModifiers: [] },
            { type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] },
          ],
        ],
      }),
    );
    expect(result).toBeNull();
  });

  it("drops labyrinth runs when connections are non-adjacent (dr=2)", () => {
    const result = parseActiveRun(
      makeLabyrinthRun({
        rows: 3,
        cols: 1,
        currentNode: { row: 0, col: 0 },
        grid: [
          [
            {
              type: "entrance",
              state: "current",
              connections: [{ row: 2, col: 0 }],
              modifiers: [],
              rewardModifiers: [],
            },
          ],
          [{ type: "combat", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] }],
          [{ type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] }],
        ],
      }),
    );
    // entrance(0,0)→boss(2,0) is non-adjacent (dr=2)
    expect(result).toBeNull();
  });

  it("filters unknown labyrinth modifier kinds", () => {
    const result = parseActiveRun(
      makeLabyrinthRun({
        rows: 1,
        cols: 2,
        currentNode: { row: 0, col: 0 },
        grid: [
          [
            {
              type: "entrance",
              state: "current",
              connections: [{ row: 0, col: 1 }],
              modifiers: ["unknown-mod"],
              rewardModifiers: [],
            },
            { type: "boss", state: "hidden", connections: [{ row: 0, col: 0 }], modifiers: [], rewardModifiers: [] },
          ],
        ],
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.labyrinthMap).not.toBeNull();
    expect(result!.labyrinthMap!.grid[0][0]!.modifiers).toEqual([]);
  });

  it("normalizes labyrinth combat pending node and modifiers", () => {
    const result = parseActiveRun(
      makeRunCandidate({
        contentSystemType: "labyrinth",
        labyrinthMap: { rows: 1, cols: 2, currentNode: { row: 0, col: 0 }, grid: valid1x2Grid },
        labyrinthPendingNode: { row: 0, col: 1 },
        activeCombat: {
          battleState: defaultBattleState(),
          activeLabyrinthModifiers: ["tempered", "unknown"],
          activeLabyrinthRewardModifiers: ["generous"],
        },
      }),
    );

    expect(result!.labyrinthPendingNode).toEqual({ row: 0, col: 1 });
    expect(result!.activeCombat?.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result!.activeCombat?.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });
});

describe("labyrinth map normalization (direct)", () => {
  it("drops labyrinth runs for non-object labyrinthMap", () => {
    const data = makeRunCandidate({ contentSystemType: "labyrinth", labyrinthMap: "bad" });
    expect(parseActiveRun(data)).toBeNull();
  });

  it("drops labyrinth runs for labyrinthMap with non-array grid", () => {
    const data = makeRunCandidate({ contentSystemType: "labyrinth", labyrinthMap: { grid: "bad" } });
    expect(parseActiveRun(data)).toBeNull();
  });
});
