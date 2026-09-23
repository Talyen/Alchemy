import { describe, expect, it } from "vitest";
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  LAUNCH_SAVE_SCHEMA_VERSION,
  SaveDataSchema,
  migrateSupportedSaveData,
} from "@/lib/validation";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { readText } from "./helpers";

describe("save migration contract", () => {
  it("tracks launch baseline at or below current schema version", () => {
    expect(Number.isInteger(LAUNCH_SAVE_SCHEMA_VERSION)).toBe(true);
    expect(Number.isInteger(CURRENT_SAVE_SCHEMA_VERSION)).toBe(true);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(LAUNCH_SAVE_SCHEMA_VERSION);
  });

  it("migrates every supported prior schema to the current version", () => {
    for (let version = LAUNCH_SAVE_SCHEMA_VERSION; version < CURRENT_SAVE_SCHEMA_VERSION; version++) {
      expect(migrateSupportedSaveData({ saveSchemaVersion: version })).toMatchObject({
        saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      });
    }
  });

  it("keeps rename logic out of active-run schema transforms", () => {
    const activeRunSource = readText("src/lib/validation/save-schemas/active-run.ts");
    expect(activeRunSource).not.toContain("boonEffects");
    expect(activeRunSource).not.toContain("runTrinkets");
    expect(activeRunSource).not.toContain("firstBurnBoon");
  });

  it("keeps defaults.ts top-level keys aligned with SaveData fields", () => {
    const defaultKeys = Object.keys(defaultSaveData).sort();
    const schemaKeys = Object.keys(SaveDataSchema.parse({})).sort();
    expect(defaultKeys).toEqual(schemaKeys);
    for (const loadBearing of ["activeRun", "saveSchemaVersion", "gameBuildVersion", "gold", "lastSavedAt"]) {
      expect(defaultKeys, `missing load-bearing SaveData field ${loadBearing}`).toContain(loadBearing);
    }
  });

  it("keeps defaults.ts values aligned with schema .catch defaults", () => {
    const schemaDefaults = SaveDataSchema.parse({});
    for (const key of Object.keys(defaultSaveData) as Array<keyof typeof defaultSaveData>) {
      if (key === "gameBuildVersion" || key === "saveSchemaVersion" || key === "lastSavedAt") continue;
      expect(
        (schemaDefaults as unknown as Record<string, unknown>)[key],
        `schema default for ${key} diverged from defaults.ts`,
      ).toEqual((defaultSaveData as unknown as Record<string, unknown>)[key]);
    }
  });
});
