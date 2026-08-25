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

  it("keeps one migration step for every supported schema increment", () => {
    const migrationSources = [
      read("src/lib/validation/migration/index.ts"),
      read("src/lib/validation/migration/steps-v11-v12.ts"),
      read("src/lib/validation/migration/steps-v12-v13.ts"),
    ].join("\n");
    expect(countMigrationSteps(migrationSources)).toBe(CURRENT_SAVE_SCHEMA_VERSION - LAUNCH_SAVE_SCHEMA_VERSION);
  });

  it("keeps rename logic out of active-run schema transforms", () => {
    const activeRunSource = read("src/lib/validation/save-schemas/active-run.ts");
    expect(activeRunSource).not.toContain("boonEffects");
    expect(activeRunSource).not.toContain("runTrinkets");
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
      "equippedTrinkets",
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
      "ownedTrinketIds",
      "musicVolume",
      "parkedRuns",
      "plantedFarms",
      "rememberAutoplayPreference",
      "runRecency",
      "saveSchemaVersion",
      "selectedAspectRatio",
      "sfxVolume",
      "talentXP",
      "unlockedTalents",
    ].sort();
    expect(defaultKeys).toEqual(expectedKeys);
  });
});
