import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import {
  LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION,
  legacyCampaignRunSave,
  legacySchemaV1Save,
  legacySchemaV2Save,
} from "../fixtures/legacy-saves";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function countMigrationSteps(source: string): number {
  const matches = source.match(/function migrateV\d+ToV\d+/g) ?? [];
  return matches.length;
}

describe("save migration guard", () => {
  it("chains migration steps through CURRENT_SAVE_SCHEMA_VERSION", () => {
    const migrationSource = read("src/lib/validation/migration.ts");
    expect(countMigrationSteps(migrationSource)).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("provides a legacy fixture for each source schema version", () => {
    for (let sourceVersion = 0; sourceVersion < CURRENT_SAVE_SCHEMA_VERSION; sourceVersion += 1) {
      expect(LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION[sourceVersion]).toBeTypeOf("function");
    }
  });

  it("migrates v0 campaign saves with gameplay progress intact", () => {
    const migrated = normalizeSaveData(legacyCampaignRunSave());
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migrated.activeRun?.runGold).toBe(42);
    expect(migrated.talentXP.physical).toBe(18);
    expect(migrated.selectedAspectRatio).toBe("16:9");
  });

  it("migrates v1 arrow talent saves to archery", () => {
    const migrated = normalizeSaveData(legacySchemaV1Save());
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migrated.talentXP.archery).toBe(12);
    expect(migrated.unlockedTalents.archery).toContain("archery-damage");
    expect(migrated.talentXP.arrow).toBeUndefined();
  });

  it("migrates v2 saves and backfills finishedRunCharacters", () => {
    const migrated = normalizeSaveData(legacySchemaV2Save());
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(Array.isArray(migrated.finishedRunCharacters)).toBe(true);
    expect(migrated.activeRun?.runGold).toBe(20);
  });

  it("keeps defaults.ts keys aligned with SaveData top-level fields", () => {
    const defaultKeys = Object.keys(defaultSaveData).sort();
    expect(defaultKeys).toContain("lastSavedAt");
    expect(defaultKeys).toContain("saveSchemaVersion");
    expect(defaultKeys).toContain("activeRun");
    expect(new Set(defaultKeys).size).toBe(defaultKeys.length);
  });
});
