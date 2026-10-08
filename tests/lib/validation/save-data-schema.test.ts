import { savedActivityFixture } from "../../fixtures/run-activity";
import { describe, it, expect } from "vitest";
import { SaveDataSchema } from "@/lib/validation";
import { defaultBattleState } from "@/lib/battle";
import { baseHomesteadSave } from "../../fixtures/saves";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";
import { SETTINGS_RANGES } from "@/lib/settings-values";
import { computeStartingMaxHealth } from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";

describe("SaveDataSchema", () => {
  it("parses a full homestead save fixture", () => {
    const result = SaveDataSchema.safeParse(baseHomesteadSave);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("recovers the shared purse from a foreground combat snapshot", () => {
    const result = SaveDataSchema.safeParse({
      gold: 0,
      activeRun: makeMinimalActiveRunInput({
        activity: savedActivityFixture("battle", { battleState: { ...defaultBattleState(), gold: 80 } }),
      }),
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) expect(result.data.gold).toBe(80);
  });

  it("recovers from corrupt fields", () => {
    const result = SaveDataSchema.safeParse({
      musicVolume: "loud",
      sfxVolume: 80,
      selectedAspectRatio: "99:99",
      brightness: 999,
      displayMode: "immersive",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.musicVolume).toBe(50);
      expect(result.data.sfxVolume).toBe(80);
      expect(result.data.selectedAspectRatio).toBe("auto");
      expect(result.data.brightness).toBe(SETTINGS_RANGES.brightness.max);
      expect(result.data.displayMode).toBe("borderless-fullscreen");
    }
  });

  it("normalizes homestead arrays into tier records", () => {
    const result = SaveDataSchema.parse({
      constructedBuildings: ["blacksmiths-forge", "blacksmiths-forge", "unknown", null],
      plantedFarms: { pasture: 1.8, orchard: -1, "herb-garden": Number.POSITIVE_INFINITY, unknown: 4 },
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(2);
    expect(result.plantedFarms.pasture).toBe(1);
    expect(result.plantedFarms.orchard).toBe(0);
    expect(result.plantedFarms["herb-garden"]).toBe(0);
    expect(result.constructedBuildings).not.toHaveProperty("unknown");
    expect(result.plantedFarms).not.toHaveProperty("unknown");
  });

  it("ignores character-only active run fragments", () => {
    const result = SaveDataSchema.parse({ activeRun: { characterId: "knight" } });
    expect(result.activeRun).toBeNull();
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
      backgroundParticlesIntensity: 40,
      backgroundGlowIntensity: 60,
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
      expect(result.data.backgroundParticlesIntensity).toBe(40);
      expect(result.data.backgroundGlowIntensity).toBe(60);
    }
  });

  it("defaults special effects intensities to full and clamps out-of-range values", () => {
    expect(SaveDataSchema.parse({}).backgroundParticlesIntensity).toBe(100);
    expect(SaveDataSchema.parse({}).backgroundGlowIntensity).toBe(100);
    expect(SaveDataSchema.parse({ backgroundParticlesIntensity: -10 }).backgroundParticlesIntensity).toBe(0);
    expect(SaveDataSchema.parse({ backgroundGlowIntensity: 250 }).backgroundGlowIntensity).toBe(100);
  });

  it("repairs profile and run XP without granting Health for unknown keywords", () => {
    const damagedXP = { burn: -10, block: 10.7, poison: Number.NaN, holy: 100, retiredKeyword: 10_000 };
    const result = SaveDataSchema.parse({
      talentXP: damagedXP,
      activeRun: makeMinimalActiveRunInput({ runTalentXP: damagedXP }),
    });
    expect(computeStartingMaxHealth(result.talentXP)).toBe(MAX_PLAYER_HEALTH + 2);
    expect(result.talentXP).toEqual({ block: 10, holy: 100 });
    expect(result.activeRun?.runTalentXP).toEqual(result.talentXP);
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
