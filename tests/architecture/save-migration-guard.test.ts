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
  legacySchemaV4Save,
  legacySchemaV5Save,
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

  it.each(Object.entries(MIGRATION_SCENARIO_FIXTURES))("migrates scenario %s idempotently", (_name, createFixture) => {
    const once = normalizeSaveData(createFixture());
    const twice = normalizeSaveData(migrateSaveDataToCurrent(once));
    expect(twice).toEqual(once);
    expect(once.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("preserves wildwood draft when migrating legacy trinket rewardType", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodTrinketReward());
    expect(migrated.activeRun?.contentSystemType).toBe("wildwood");
    expect(migrated.activeRun?.wildwoodDraft?.rewardType).toBe("trinket");
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

  it("migrates v3 trinket terminology through to trinkets", () => {
    const migrated = normalizeSaveData(LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION[3]());
    expect(migrated.discoveredTrinketIds).toEqual(["bone-charm"]);
    expect(migrated.activeRun?.runTrinkets).toEqual(["bone-charm"]);
    expect(migrated.gearInventory).toEqual([]);
  });

  it("migrates v4 content v1 saves with boon-era fields to trinket equivalents", () => {
    const migrated = normalizeSaveData(legacySchemaV4Save());
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migrated.contentVersion).toBe(2);
    expect(migrated.discoveredTrinketIds).toEqual(["bone-charm"]);
    expect(migrated.unlockedTalents.wish).toContain("wish-trinket");
    expect(migrated.activeRun?.runTrinkets).toEqual(["bone-charm"]);
    expect(migrated.activeRun?.runGold).toBe(55);
    expect(migrated.gearInventory[0]?.affixes).toBeDefined();
  });

  it("migrates v3 mid-combat trinketEffects to trinketEffects and burn flags", () => {
    const migrated = normalizeSaveData(legacySchemaV3MidCombatTrinketSave());
    expect(migrated.activeRun?.activeCombat?.battleState.trinketEffects.boneCharmHealOnKill).toBe(3);
    expect(migrated.activeRun?.activeCombat?.battleState.trinketEffects.firstBurnDoubled).toBe(true);
    expect(migrated.activeRun?.activeCombat?.battleState.flags.firstBurnTrinketDoubledUsed).toBe(true);
    expect(migrated.activeRun?.runTrinkets).toEqual(["meteorite", "bone-charm"]);
  });

  it("migrates v5 saves and scales up astral gear affix values", () => {
    const migrated = normalizeSaveData(legacySchemaV5Save());
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);

    // gearInventory check
    const item = migrated.gearInventory.find((g) => g.instanceId === "gear-1");
    expect(item).toBeDefined();
    // flat-physical has scale 2: 1 * 2 = 2
    expect(item?.affixes.find((a) => a.id === "flat-physical")?.value).toBe(2);
    // poison-leech has scale 1: 5 * 1 = 5
    expect(item?.affixes.find((a) => a.id === "poison-leech")?.value).toBe(5);

    // activeRun gear check
    const activeItem = migrated.activeRun?.equipmentShopState?.gear.find((g) => g.instanceId === "gear-active-1");
    expect(activeItem).toBeDefined();
    // flat-physical has scale 2: 2 * 2 = 4
    expect(activeItem?.affixes.find((a) => a.id === "flat-physical")?.value).toBe(4);
    // poison-leech has scale 1: 7 * 1 = 7
    expect(activeItem?.affixes.find((a) => a.id === "poison-leech")?.value).toBe(7);

    // pending rewards gear choices check
    const reward = migrated.activeRun?.pendingReward;
    expect(reward?.rewardType).toBe("gear");
    const rewardItem = reward?.gearChoices.find((g: any) => g.instanceId === "gear-reward-1");
    expect(rewardItem).toBeDefined();
    expect(rewardItem?.affixes.find((a: any) => a.id === "flat-physical")?.value).toBe(2);
    expect(rewardItem?.affixes.find((a: any) => a.id === "poison-leech")?.value).toBe(5);
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
