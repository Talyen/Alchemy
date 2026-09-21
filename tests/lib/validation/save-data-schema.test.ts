import { describe, it, expect } from "vitest";
import {
  SaveDataSchema,
  CURRENT_SAVE_SCHEMA_VERSION,
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
} from "@/lib/validation";
import { defaultBattleState } from "@/lib/battle";
import { baseHomesteadSave } from "../../fixtures/saves";
import { currentSchemaCampaignSave } from "../../fixtures/current-saves";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";
import { ASPECT_RATIO_VALUES, DISPLAY_MODE_VALUES, SETTINGS_RANGES } from "@/lib/settings-values";

describe("SaveDataSchema", () => {
  it("defaults screen effects off and repairs each control independently", () => {
    const defaults = SaveDataSchema.parse({}).screenEffects;
    expect(defaults.enabled).toBe(false);
    for (const effect of [defaults.scanlines, defaults.tint, defaults.edges, defaults.grain]) {
      expect(effect).toMatchObject({ enabled: false, strength: 50 });
    }
    const effects = SaveDataSchema.parse({
      screenEffects: {
        enabled: true,
        scanlines: { enabled: true, strength: -10, spacing: "wide" },
        grain: { enabled: "yes", strength: 200 },
        tint: { color: "bad", strength: "bad" },
      },
    }).screenEffects;
    expect(effects.scanlines).toEqual({ enabled: true, strength: 0, spacing: "wide" });
    expect(effects.grain).toEqual({ enabled: false, strength: 100 });
    expect(effects.tint).toEqual({ enabled: false, strength: 50, color: "amber" });
    expect(
      SaveDataSchema.parse({ backgroundLights: { enabled: true, motion: "still", strength: 35 } }).backgroundLights,
    ).toEqual({ enabled: true, strength: 35, motion: "still" });
    expect(SaveDataSchema.parse({}).backgroundLights).toEqual({ enabled: false, strength: 50, motion: "flowing" });
  });

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

  it("recovers the shared purse from a foreground combat snapshot", () => {
    const result = SaveDataSchema.safeParse({
      gold: 0,
      activeRun: makeMinimalActiveRunInput({
        activeCombat: { battleState: { ...defaultBattleState(), gold: 80 } },
      }),
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) expect(result.data.gold).toBe(80);
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
      expect(result.data.brightness).toBe(SETTINGS_RANGES.brightness.max);
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

  it.each(DISPLAY_MODE_VALUES)("passes through display mode %s", (mode) => {
    expect(SaveDataSchema.parse({ displayMode: mode }).displayMode).toBe(mode);
  });

  it.each(ASPECT_RATIO_VALUES)("passes through aspect ratio %s", (aspectRatio) => {
    expect(SaveDataSchema.parse({ selectedAspectRatio: aspectRatio }).selectedAspectRatio).toBe(aspectRatio);
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

describe("validation metadata", () => {
  it("CURRENT_SAVE_SCHEMA_VERSION matches the current save fixture", () => {
    const migrated = SaveDataSchema.parse(currentSchemaCampaignSave());
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("exposes stable game and content version constants", () => {
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    expect(CURRENT_GAME_BUILD_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CURRENT_CONTENT_VERSION).toBeGreaterThanOrEqual(1);
  });
});
