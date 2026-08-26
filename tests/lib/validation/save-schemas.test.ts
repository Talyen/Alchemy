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
import { generateLabyrinthMap, withClearedLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { LABYRINTH_ENTRANCE_NODE_ID } from "@/lib/content-systems/labyrinth/data";
import { baseHomesteadSave } from "../../fixtures/saves";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";

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

  it("keeps a spent purse at 0 when a parked combat snapshot still has gold", () => {
    const result = SaveDataSchema.safeParse({
      gold: 0,
      activeRun: null,
      parkedRuns: {
        campaign: makeMinimalActiveRunInput({
          contentSystemType: "campaign",
          runGold: 0,
          activeCombat: { battleState: { ...defaultBattleState(), gold: 80 } },
        }),
      },
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.gold).toBe(0);
      expect(result.data.parkedRuns.campaign?.activeCombat?.battleState.gold).toBe(80);
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

  it("normalizes homestead arrays into tier records", () => {
    const result = SaveDataSchema.parse({
      constructedBuildings: ["blacksmiths-forge"],
      plantedFarms: ["pasture"],
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
  });

  it("ignores character-only active run fragments", () => {
    const result = SaveDataSchema.parse({ activeRun: { characterId: "knight" } });
    expect(result.activeRun).toBeNull();
  });

  it("strips legacy uiScale without wiping other settings", () => {
    const result = SaveDataSchema.parse({ displayMode: "fullscreen", uiScale: "120" });
    expect(result.displayMode).toBe("fullscreen");
    expect(result).not.toHaveProperty("uiScale");
  });

  it("normalizes corrupt discovery arrays while preserving unknown string ids", () => {
    const result = SaveDataSchema.parse({
      discoveredCardIds: ["slash", 123, "not-in-catalog", "slash", null],
      encounteredEnemyIds: ["goblin", {}, "future-enemy", "goblin"],
      discoveredTrinketIds: ["bone-charm", false, "future-boon", "bone-charm"],
      discoveredUniqueIds: ["wardbreaker", false, "future-unique", "wardbreaker"],
    });
    expect(result.discoveredCardIds).toEqual(["slash", "not-in-catalog"]);
    expect(result.encounteredEnemyIds).toEqual(["goblin", "future-enemy"]);
    expect(result.discoveredTrinketIds).toEqual(["bone-charm", "future-boon"]);
    expect(result.discoveredUniqueIds).toEqual(["wardbreaker", "future-unique"]);
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

  it("passes through a valid aspect ratio", () => {
    expect(SaveDataSchema.parse({ selectedAspectRatio: "16:9" }).selectedAspectRatio).toBe("16:9");
  });

  it("falls back for an invalid aspect ratio", () => {
    expect(SaveDataSchema.parse({ selectedAspectRatio: "99:99" }).selectedAspectRatio).toBe("auto");
  });

  it.each(["windowed", "borderless-fullscreen", "fullscreen"] as const)("passes through display mode %s", (mode) => {
    expect(SaveDataSchema.parse({ displayMode: mode }).displayMode).toBe(mode);
  });

  it("falls back for an invalid display mode", () => {
    expect(SaveDataSchema.parse({ displayMode: "fake-mode" }).displayMode).toBe("borderless-fullscreen");
  });

  it("passes through valid talent XP", () => {
    const result = SaveDataSchema.parse({ talentXP: { burn: 100, block: 50 } });
    expect(result.talentXP.burn).toBe(100);
    expect(result.talentXP.block).toBe(50);
  });

  it("filters negative talent XP and floors fractional values", () => {
    const result = SaveDataSchema.parse({ talentXP: { burn: -10, block: 10.7, poison: Number.NaN } });
    expect(result.talentXP.burn).toBeUndefined();
    expect(result.talentXP.block).toBe(10);
    expect(result.talentXP.poison).toBeUndefined();
  });

  it("falls back to an empty talent XP map for non-object input", () => {
    expect(SaveDataSchema.parse({ talentXP: null }).talentXP).toEqual({});
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

describe("ActiveRunDataSchema persisted session payloads", () => {
  const run = (overrides: Record<string, unknown> = {}) =>
    makeMinimalActiveRunInput({ runGold: 0, selectedDifficulty: null, labyrinthMap: null, ...overrides });

  it("parses a valid run", () => {
    const result = ActiveRunDataSchema.safeParse(run());
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual([]);
    }
  });

  it("parses destination resume fields", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        currentScreen: "rewards",
        interruptedFlow: {
          kind: "destination",
          destinations: ["Campfire"],
          selectedBossId: null,
          lastVictoryEnemyType: null,
          lastVictoryContentSystem: null,
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.currentScreen).toBe("rewards");
      expect(result.data.interruptedFlow).toEqual({
        kind: "destination",
        destinations: ["Campfire"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      });
    }
  });

  it("rejects invalid resume screens", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({ currentScreen: "not-a-screen", interruptedFlow: { kind: "none" } }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentScreen).toBeNull();
    }
  });

  it("normalizes encountered run enemy IDs", () => {
    const result = ActiveRunDataSchema.safeParse(run({ encounteredRunEnemyIds: ["goblin", "goblin", 1] }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual(["goblin"]);
    }
  });

  it("merges partial legacy gearEffects with defaults on mid-combat hydrate", () => {
    const defaults = defaultBattleState();
    const legacyGearEffects = {
      flatPhysicalDamage: 4,
      flatStunDamage: 2,
    };
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: {
            ...defaults,
            gearEffects: legacyGearEffects,
          },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );
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
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
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
      }),
    );

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition?.kind).toBe("enemy-turn");
  });

  it("accepts legacy-enemy-turn pending transition markers", () => {
    const defaults = defaultBattleState();
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: { ...defaults, turnPhase: "enemy", hand: [] },
          pendingBattleTransition: { kind: "legacy-enemy-turn" },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition).toEqual({ kind: "legacy-enemy-turn" });
  });

  it("accepts a resumable opening draw transition", () => {
    const defaults = defaultBattleState();
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: { ...defaults, hand: [] },
          pendingBattleTransition: {
            kind: "opening-draw",
            resultState: defaults,
          },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition?.kind).toBe("opening-draw");
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

    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
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
      }),
    );

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
    expect(transition.resultState.flags.firstHolyCardFreeUsed).toBe(false);
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
    const result = ActiveRunDataSchema.safeParse(run({ runDeck: legacyDeck }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runDeck.length).toBe(1);
    }
  });

  it("parses persisted shop slices", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        runGold: 50,
        roomsEncountered: 2,
        destinationIndexInAct: 1,
        currentScreen: "trinket-shop",
        trinketShopState: {
          trinketIds: ["lucky-clover"],
          refreshesLeft: 2,
          firstPurchaseUsed: true,
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.trinketShopState?.trinketIds).toEqual(["lucky-clover"]);
      expect(result.data.trinketShopState?.refreshesLeft).toBe(2);
    }
  });

  it("defaults companion reward ids for legacy pending rewards", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        interruptedFlow: {
          kind: "primary-reward",
          pending: {
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
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success && result.data.interruptedFlow.kind === "primary-reward") {
      expect(result.data.interruptedFlow.pending.companionChoiceIds).toEqual([]);
    }
  });

  it("rejects pending gear rewards with no valid choices", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        interruptedFlow: {
          kind: "primary-reward",
          pending: {
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
        },
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interruptedFlow).toEqual({ kind: "none" });
    }
  });

  it("keeps Wildwood rewards on interruptedFlow without nested draft reward fields", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        contentSystemType: "wildwood",
        currentScreen: "rewards",
        interruptedFlow: {
          kind: "primary-reward",
          pending: {
            rewardType: "card",
            choiceIds: ["slash", "bash", "block"],
            companionChoiceIds: [],
            selectedId: null,
            gold: 0,
            materials: {},
            destinations: [],
            selectedBossId: null,
            lastVictoryEnemyType: "boss",
            lastVictoryContentSystem: "wildwood",
          },
        },
        wildwoodDraft: {
          phase: "reward",
          draftChoices: [],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: [],
          currentRewardTraitIds: [],
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.wildwoodDraft).toMatchObject({ phase: "reward" });
    expect(result.data.wildwoodDraft).not.toHaveProperty("rewardType");
    expect(result.data.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({ rewardType: "card", choiceIds: ["slash", "bash", "block"] }),
      }),
    );
  });
});

describe("BattleCardEffectSchema", () => {
  it.each([
    ["damage effect", { kind: "damage", damageType: "physical", amount: 6 }],
    ["player-status effect", { kind: "player-status", status: "block", amount: 8 }],
    ["heal effect", { kind: "heal", amount: 5 }],
    ["summon-companion", { kind: "summon-companion", companionId: "wolf" }],
    ["self-damage with enemy status damage type", { kind: "self-damage", damageType: "burn", amount: 3 }],
    ["remove-player-status", { kind: "remove-player-status", status: "poison" }],
    ["lose-health", { kind: "lose-health", amount: 1 }],
    ["draw-cards", { kind: "draw-cards", amount: 2 }],
    ["remove-enemy-armor", { kind: "remove-enemy-armor", amount: 2 }],
    ["multiply-enemy-status", { kind: "multiply-enemy-status", status: "freeze", factor: 2 }],
  ])("parses %s", (_label, effect) => {
    const result = BattleCardEffectSchema.safeParse(effect);
    expect(result.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "unknown", amount: 5 });
    expect(result.success).toBe(false);
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

  it("parses a freshly generated map", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const result = LabyrinthMapSchema.safeParse(map);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("parses a map after a node is cleared", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const entryId = map.nodes[LABYRINTH_ENTRANCE_NODE_ID]!.outgoingIds[0]!;
    const next = withClearedLabyrinthNode(map, entryId, createSeededRng(1));
    const result = LabyrinthMapSchema.safeParse(next);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("catches a map with no entrance", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    delete map.nodes[LABYRINTH_ENTRANCE_NODE_ID];
    map.floors = map.floors.filter((floor) => floor.depth !== 0);
    const result = LabyrinthMapSchema.safeParse(map);
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

  it("filters non-array entries", () => {
    const result = UnlockedTalentsSchema.safeParse({ burn: "bad" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.burn).toBeUndefined();
    }
  });

  it("falls back for non-object input", () => {
    const result = UnlockedTalentsSchema.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
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
      expect(result.data.alchemist).toEqual([]);
      expect(result.data.warlock).toEqual([]);
      expect(result.data.druid).toEqual([]);
      expect(result.data.wildcard).toEqual([]);
    }
  });
});
