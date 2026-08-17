import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function countMigrationSteps(source: string): number {
  const matches = source.match(/export function migrateV\d+ToV\d+/g) ?? [];
  return matches.length;
}

describe("save migration contract", () => {
  it("tracks launch baseline at or below current schema version", () => {
    expect(LAUNCH_SAVE_SCHEMA_VERSION).toBe(11);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(LAUNCH_SAVE_SCHEMA_VERSION);
  });

  it("has no schema migration step functions at the pre-launch floor", () => {
    const migrationSource = read("src/lib/validation/migration/index.ts");
    expect(migrationSource).not.toMatch(/SCHEMA_MIGRATIONS/);
    expect(countMigrationSteps(migrationSource)).toBe(0);
    expect(CURRENT_SAVE_SCHEMA_VERSION - LAUNCH_SAVE_SCHEMA_VERSION).toBe(0);
  });

  it("keeps rename logic out of active-run schema transforms", () => {
    const activeRunSource = read("src/lib/validation/save-schemas/active-run.ts");
    expect(activeRunSource).not.toContain("boonEffects");
    expect(activeRunSource).not.toContain("runBoons");
    expect(activeRunSource).not.toContain("firstBurnBoon");
  });

  it("keeps defaults.ts top-level keys aligned with SaveData fields", () => {
    const defaultKeys = Object.keys(defaultSaveData).sort();
    const expectedKeys = [
      "activeRun",
      "autoEndTurn",
      "autoplayEnabled",
      "bondedCompanions",
      "brightness",
      "completedDifficulties",
      "completedResearch",
      "constructedBuildings",
      "contentVersion",
      "discoveredTrinketIds",
      "discoveredCardIds",
      "displayMode",
      "encounteredEnemyIds",
      "finishedRunCharacters",
      "gameBuildVersion",
      "gearInventories",
      "gearLoadouts",
      "gold",
      "craftingCurrencies",
      "lastSavedAt",
      "masterVolume",
      "materialInventory",
      "muteInBackground",
      "musicVolume",
      "plantedFarms",
      "rememberAutoplayPreference",
      "saveSchemaVersion",
      "selectedAspectRatio",
      "sfxVolume",
      "talentXP",
      "unlockedTalents",
    ].sort();
    expect(defaultKeys).toEqual(expectedKeys);
  });
});
