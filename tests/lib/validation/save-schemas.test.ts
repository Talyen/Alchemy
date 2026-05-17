import { describe, it, expect } from "vitest";
import {
  SaveDataSchema,
  ActiveRunDataSchema,
  BattleCardEffectSchema,
  LabyrinthMapSchema,
  MaterialInventorySchema,
  CompletedDifficultiesSchema,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation";

describe("SaveDataSchema", () => {
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
      expect(result.data.musicVolume).toBe(35);
      expect(result.data.materialInventory.wood).toBe(0);
    }
  });

  it("recovers from corrupt fields", () => {
    const result = SaveDataSchema.safeParse({
      musicVolume: "loud",
      brightness: 999,
      uiScale: "huge",
      displayMode: "immersive",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.musicVolume).toBe(35);
      expect(result.data.brightness).toBe(150);
      expect(result.data.uiScale).toBe("100");
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
      selectedResolution: "1920x1200",
      uiScale: "120",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.musicVolume).toBe(50);
      expect(result.data.sfxVolume).toBe(80);
      expect(result.data.masterVolume).toBe(90);
      expect(result.data.muteInBackground).toBe(false);
      expect(result.data.autoEndTurn).toBe(false);
      expect(result.data.brightness).toBe(120);
      expect(result.data.selectedResolution).toBe("1920x1200");
      expect(result.data.uiScale).toBe("120");
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
  });

  it("migrates sorcerer to wizard", () => {
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
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.characterId).toBe("wizard");
    }
  });

  it("rejects health > maxHealth", () => {
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
    expect(result.success).toBe(false);
  });

  it("replaces legacy starter deck for unstarted run", () => {
    const legacyDeck = [
      { id: "slash", title: "Slash", descriptionLines: [], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] },
      { id: "bash", title: "Bash", descriptionLines: [], art: "", cost: 2, effects: [{ kind: "damage", damageType: "physical", amount: 10 }] },
      { id: "block", title: "Block", descriptionLines: [], art: "", cost: 1, effects: [{ kind: "player-status", status: "block", amount: 8 }] },
      { id: "anvil", title: "Anvil", descriptionLines: [], art: "", cost: 2, effects: [{ kind: "damage", damageType: "physical", amount: 8 }] },
      { id: "plate-mail", title: "Plate Mail", descriptionLines: [], art: "", cost: 1, effects: [{ kind: "player-status", status: "armor", amount: 5 }] },
      { id: "apple", title: "Apple", descriptionLines: [], art: "", cost: 1, effects: [{ kind: "heal", amount: 5 }] },
      { id: "meteor", title: "Meteor", descriptionLines: [], art: "", cost: 3, effects: [{ kind: "damage", damageType: "physical", amount: 15 }] },
      { id: "blessed-aegis", title: "Blessed Aegis", descriptionLines: [], art: "", cost: 2, effects: [{ kind: "player-status", status: "block", amount: 12 }] },
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
      expect(result.data.runDeck.length).toBeGreaterThan(0);
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
