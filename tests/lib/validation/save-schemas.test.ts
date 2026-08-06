import { describe, it, expect } from "vitest";
import {
  SaveDataSchema,
  ActiveRunDataSchema,
  BattleCardEffectSchema,
  LabyrinthMapSchema,
  MaterialInventorySchema,
  CompletedDifficultiesSchema,
  UnlockedTalentsSchema,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation";
import { defaultBattleState } from "@/lib/battle";
import { GEAR_EFFECT_KEYS } from "@/lib/gear";
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap, withCurrentNode } from "@/lib/content-systems/labyrinth/map-generation";
import { baseHomesteadSave } from "../../fixtures/saves";

describe("SaveDataSchema", () => {
  it("parses a full homestead save fixture", () => {
    const result = SaveDataSchema.safeParse(baseHomesteadSave);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("parses a valid minimal save", () => {
    const result = SaveDataSchema.safeParse({
      activeRun: null,
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
      expect(result.data.activeRun).toBeNull();
    }
  });

  it("handles completely missing data", () => {
    const result = SaveDataSchema.safeParse(undefined);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.musicVolume).toBe(50);
      expect(result.data.materialInventory.wood).toBe(0);
    }
  });

  it("recovers from corrupt fields", () => {
    const result = SaveDataSchema.safeParse({
      musicVolume: "loud",
      brightness: 999,
      displayMode: "immersive",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.musicVolume).toBe(50);
      expect(result.data.brightness).toBe(150);
      expect(result.data.displayMode).toBe("borderless-fullscreen");
    }
  });

  it("preserves valid field values", () => {
    const result = SaveDataSchema.safeParse({
      musicVolume: 50,
      sfxVolume: 80,
      masterVolume: 90,
      muteInBackground: false,
      autoEndTurn: false,
      brightness: 120,
      selectedAspectRatio: "16:10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.musicVolume).toBe(50);
      expect(result.data.sfxVolume).toBe(80);
      expect(result.data.masterVolume).toBe(90);
      expect(result.data.muteInBackground).toBe(false);
      expect(result.data.autoEndTurn).toBe(false);
      expect(result.data.brightness).toBe(120);
      expect(result.data.selectedAspectRatio).toBe("16:10");
    }
  });

  it("uses default aspect ratio when selectedResolution is omitted", () => {
    const result = SaveDataSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedAspectRatio).toBe("auto");
    }
  });

  it("filters invalid finishedRunCharacters without wiping valid IDs", () => {
    const result = SaveDataSchema.safeParse({
      finishedRunCharacters: ["knight", "not-a-character", "rogue", "knight", 42],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.finishedRunCharacters).toEqual(["knight", "rogue"]);
    }
  });
});

describe("ActiveRunDataSchema", () => {
  it("parses a valid run", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual([]);
    }
  });

  it("parses destination resume fields", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      currentScreen: "rewards",
      destinationChoices: ["Campfire"],
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.currentScreen).toBe("rewards");
      expect(result.data.destinationChoices).toEqual(["Campfire"]);
    }
  });

  it("rejects invalid resume screens", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      currentScreen: "not-a-screen",
      destinationChoices: [],
      pendingReward: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentScreen).toBeNull();
    }
  });

  it("normalizes encountered run enemy IDs", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      encounteredRunEnemyIds: ["goblin", "goblin", 1],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual(["goblin"]);
    }
  });

  it("rejects retired characterId aliases", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "sorcerer",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });
    expect(result.success).toBe(false);
  });

  it("clamps health to maxHealth when health > maxHealth", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 50,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runPlayerHealth).toBe(30);
    }
  });

  it("rejects labyrinth runs without a labyrinth map", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "labyrinth",
      labyrinthMap: null,
    });
    expect(result.success).toBe(false);
  });

  it("merges partial legacy gearEffects with defaults on mid-combat hydrate", () => {
    const defaults = defaultBattleState();
    const legacyGearEffects = {
      flatPhysicalDamage: 4,
      flatStunDamage: 2,
    };
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 1,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      activeCombat: {
        battleState: {
          ...defaults,
          gearEffects: legacyGearEffects,
        },
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    const gearEffects = result.data.activeCombat!.battleState.gearEffects;
    expect(gearEffects.flatPhysicalDamage).toBe(4);
    expect(gearEffects.flatStunDamage).toBe(2);
    for (const key of GEAR_EFFECT_KEYS) {
      if (key === "flatPhysicalDamage" || key === "flatStunDamage") continue;
      expect(gearEffects[key]).toBe(0);
    }
  });

  it("defaults missing battle transition metadata and accepts resumable enemy turns", () => {
    const defaults = defaultBattleState();
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 1,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      activeCombat: {
        battleState: { ...defaults, turnPhase: "enemy", hand: [] },
        pendingBattleTransition: {
          kind: "enemy-turn",
          resultState: defaults,
          playerTurnSkipped: false,
        },
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    });

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition?.kind).toBe("enemy-turn");
  });

  it("accepts legacy-enemy-turn pending transition markers", () => {
    const defaults = defaultBattleState();
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 1,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      activeCombat: {
        battleState: { ...defaults, turnPhase: "enemy", hand: [] },
        pendingBattleTransition: { kind: "legacy-enemy-turn" },
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    });

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition).toEqual({ kind: "legacy-enemy-turn" });
  });

  it("normalizes enemy-turn resultState manifests after JSON save/load", () => {
    const defaults = defaultBattleState();
    const strippedResultState = JSON.parse(
      JSON.stringify({
        ...defaults,
        turn: 3,
        playerHealth: 20,
        gearEffects: { flatPhysicalDamage: 2 },
        flags: { divineAegisTriggered: true },
      }),
    );
    const strippedBattleState = JSON.parse(JSON.stringify({ ...defaults, turnPhase: "enemy", hand: [], turn: 2 }));

    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 1,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      activeCombat: {
        battleState: strippedBattleState,
        pendingBattleTransition: {
          kind: "enemy-turn",
          resultState: strippedResultState,
          playerTurnSkipped: false,
        },
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    });

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;

    const transition = result.data.activeCombat?.pendingBattleTransition;
    expect(transition?.kind).toBe("enemy-turn");
    if (transition?.kind !== "enemy-turn") return;

    expect(transition.resultState.turn).toBe(3);
    expect(transition.resultState.playerHealth).toBe(20);
    expect(transition.resultState.gearEffects.flatPhysicalDamage).toBe(2);
    expect(transition.resultState.gearEffects.flatStunDamage).toBe(0);
    expect(transition.resultState.flags.divineAegisTriggered).toBe(true);
    expect(transition.resultState.flags.firstPhysicalCardFreeUsed).toBe(false);
  });

  it("preserves run deck array for unstarted run", () => {
    const legacyDeck = [
      {
        id: "slash",
        title: "Slash",
        descriptionLines: [],
        art: "",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      },
    ];
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: legacyDeck,
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runDeck.length).toBe(1);
    }
  });

  it("parses persisted shop slices", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 50,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 2,
      currentAct: 1,
      destinationIndexInAct: 1,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      currentScreen: "trinket-shop",
      trinketShopState: {
        trinketIds: ["lucky-clover"],
        refreshesLeft: 2,
        firstPurchaseUsed: true,
      },
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.trinketShopState?.trinketIds).toEqual(["lucky-clover"]);
      expect(result.data.trinketShopState?.refreshesLeft).toBe(2);
    }
  });

  it("defaults companion reward ids for legacy pending rewards", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      pendingReward: {
        rewardType: "card",
        choiceIds: ["slash"],
        selectedId: null,
        gold: 0,
        materials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) expect(result.data.pendingReward?.companionChoiceIds).toEqual([]);
  });

  it("rejects pending gear rewards with no valid choices", () => {
    const result = ActiveRunDataSchema.safeParse({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      pendingReward: {
        rewardType: "gear",
        gearChoices: [],
        selectedId: null,
        gold: 0,
        materials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pendingReward).toBeNull();
    }
  });
});

describe("BattleCardEffectSchema", () => {
  it("parses damage effect", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "damage", damageType: "physical", amount: 6 });
    expect(result.success).toBe(true);
  });

  it("parses player-status effect", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "player-status", status: "block", amount: 8 });
    expect(result.success).toBe(true);
  });

  it("parses heal effect", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "heal", amount: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "unknown", amount: 5 });
    expect(result.success).toBe(false);
  });

  it("parses summon-companion", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "summon-companion", companionId: "wolf" });
    expect(result.success).toBe(true);
  });

  it("parses self-damage with enemy status damage type", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "self-damage", damageType: "burn", amount: 3 });
    expect(result.success).toBe(true);
  });

  it("parses remove-player-status", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "remove-player-status", status: "poison" });
    expect(result.success).toBe(true);
  });

  it("parses lose-health", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "lose-health", amount: 1 });
    expect(result.success).toBe(true);
  });

  it("parses draw-cards", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "draw-cards", amount: 2 });
    expect(result.success).toBe(true);
  });

  it("parses remove-enemy-armor", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "remove-enemy-armor", amount: 2 });
    expect(result.success).toBe(true);
  });

  it("parses multiply-enemy-status", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "multiply-enemy-status", status: "freeze", factor: 2 });
    expect(result.success).toBe(true);
  });
});

describe("LabyrinthMapSchema", () => {
  it("parses null as null", () => {
    const result = LabyrinthMapSchema.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("catches invalid input", () => {
    const result = LabyrinthMapSchema.safeParse({ grid: "invalid" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("parses a freshly generated map (one current node)", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const result = LabyrinthMapSchema.safeParse(map);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("parses a map after a node transition (one current node)", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const entrance = map.grid[0][Math.floor(9 / 2)]!;
    const target = entrance.connections[0];
    const next = withCurrentNode(map, target.row, target.col);
    const result = LabyrinthMapSchema.safeParse(next);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("catches a map with zero current nodes", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    // Simulate the bug: remove all "current" state from the grid.
    for (const row of map.grid) {
      for (const node of row) {
        if (node && node.state === "current") node.state = "cleared";
      }
    }
    const result = LabyrinthMapSchema.safeParse(map);
    // Schema uses .catch(null), so failures produce null instead of throwing.
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

describe("MaterialInventorySchema", () => {
  it("ensures all material keys exist", () => {
    const result = MaterialInventorySchema.safeParse({ wood: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wood).toBe(5);
      expect(result.data.iron).toBe(0);
      expect(result.data.herbs).toBe(0);
      expect(result.data.food).toBe(0);
      expect(result.data.crystal).toBe(0);
    }
  });

  it("rejects negative values", () => {
    const result = MaterialInventorySchema.safeParse({ wood: -5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wood).toBe(0);
    }
  });
});

describe("UnlockedTalentsSchema", () => {
  it("drops mismatched, unknown, and placeholder talent ids", () => {
    const result = UnlockedTalentsSchema.safeParse({
      physical: ["physical-brute-force", "burn-dmg-1", "unknown-talent"],
      consume: ["consume-6"],
      burn: ["burn-dmg-1"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        physical: ["physical-brute-force"],
        burn: ["burn-dmg-1"],
      });
    }
  });
});

describe("CompletedDifficultiesSchema", () => {
  it("ensures all character keys exist", () => {
    const result = CompletedDifficultiesSchema.safeParse({ knight: ["difficulty-1"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.knight).toEqual(["difficulty-1"]);
      expect(result.data.rogue).toEqual([]);
      expect(result.data.wizard).toEqual([]);
      expect(result.data.ranger).toEqual([]);
    }
  });
});
