import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";
import { migrateSaveDataToCurrent } from "@/lib/validation/migration";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import {
  LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION,
  MIGRATION_SCENARIO_FIXTURES,
  legacyCampaignRunSave,
  legacySchemaV1Save,
  legacySchemaV2Save,
  legacySchemaV3MidCombatTrinketSave,
} from "../fixtures/legacy-saves";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function countMigrationSteps(source: string): number {
  const matches = source.match(/export function migrateV\d+ToV\d+/g) ?? [];
  return matches.length;
}

function rawActiveRun(fixture: Record<string, unknown>) {
  return fixture.activeRun as Record<string, unknown> | null | undefined;
}

describe("save migration guard", () => {
  it("chains migration steps through CURRENT_SAVE_SCHEMA_VERSION", () => {
    const migrationSource = read("src/lib/validation/migration/steps.ts");
    expect(countMigrationSteps(migrationSource)).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("provides a legacy fixture for each source schema version", () => {
    for (let sourceVersion = 0; sourceVersion < CURRENT_SAVE_SCHEMA_VERSION; sourceVersion += 1) {
      expect(LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION[sourceVersion]).toBeTypeOf("function");
    }
  });

  it.each(Object.entries(LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION))(
    "migrates version %s fixtures idempotently",
    (_version, createFixture) => {
      const once = normalizeSaveData(createFixture());
      const twice = normalizeSaveData(migrateSaveDataToCurrent(once));
      expect(twice).toEqual(once);
      expect(once.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    },
  );

  it.each(Object.entries(MIGRATION_SCENARIO_FIXTURES))(
    "migrates scenario %s idempotently",
    (_name, createFixture) => {
      const once = normalizeSaveData(createFixture());
      const twice = normalizeSaveData(migrateSaveDataToCurrent(once));
      expect(twice).toEqual(once);
      expect(once.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    },
  );

  it("preserves wildwood draft when migrating legacy trinket rewardType", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodTrinketReward());
    expect(migrated.activeRun?.contentSystemType).toBe("wildwood");
    expect(migrated.activeRun?.wildwoodDraft?.rewardType).toBe("boon");
    expect(migrated.activeRun?.wildwoodDraft?.phase).toBe("reward");
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

  it("migrates v3 trinket terminology to boons", () => {
    const migrated = normalizeSaveData(LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION[3]());
    expect(migrated.discoveredBoonIds).toEqual(["bone-charm"]);
    expect(migrated.activeRun?.runBoons).toEqual(["bone-charm"]);
    expect(migrated.activeRun?.discoveredBoonIdsAtRunStart).toEqual(["bone-charm"]);
    expect(migrated.gearInventory).toEqual([]);
  });

  it("migrates v3 mid-combat trinketEffects to boonEffects and burn flags", () => {
    const migrated = normalizeSaveData(legacySchemaV3MidCombatTrinketSave());
    expect(migrated.activeRun?.activeCombat?.battleState.boonEffects.boneCharmHealOnKill).toBe(3);
    expect(migrated.activeRun?.activeCombat?.battleState.boonEffects.firstBurnDoubled).toBe(true);
    expect(migrated.activeRun?.activeCombat?.battleState.flags.firstBurnBoonDoubledUsed).toBe(true);
    expect(migrated.activeRun?.runBoons).toEqual(["meteorite", "bone-charm"]);
  });

  it("does not drop wildwood active runs during migration", () => {
    for (const createFixture of [
      ...Object.values(LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION),
      ...Object.values(MIGRATION_SCENARIO_FIXTURES),
    ]) {
      const raw = createFixture();
      const activeRun = rawActiveRun(raw);
      if (activeRun?.contentSystemType !== "wildwood") continue;
      const migrated = normalizeSaveData(raw);
      expect(migrated.activeRun?.wildwoodDraft).not.toBeNull();
    }
  });

  it("keeps defaults.ts keys aligned with SaveData top-level fields", () => {
    const defaultKeys = Object.keys(defaultSaveData).sort();
    expect(defaultKeys).toContain("lastSavedAt");
    expect(defaultKeys).toContain("saveSchemaVersion");
    expect(defaultKeys).toContain("activeRun");
    expect(new Set(defaultKeys).size).toBe(defaultKeys.length);
  });
});
