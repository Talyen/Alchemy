import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";
import { migrateSaveDataToCurrent } from "@/lib/validation/migration";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { cardLibrary } from "@/lib/game-data/cards";
import { TOMBSTONED_CARD_IDS } from "@/lib/validation/migration/tombstoned-content-ids";
import {
  CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION,
  MIGRATION_SCENARIO_FIXTURES,
  currentSchemaCampaignSave,
  currentSchemaMidCombatTrinketSave,
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
  it("has no schema migration step functions at the pre-launch floor", () => {
    const migrationSource = read("src/lib/validation/migration/index.ts");
    expect(migrationSource).not.toMatch(/SCHEMA_MIGRATIONS/);
    expect(countMigrationSteps(migrationSource)).toBe(0);
    expect(CURRENT_SAVE_SCHEMA_VERSION - LAUNCH_SAVE_SCHEMA_VERSION).toBe(0);
  });

  it("provides a fixture for each supported source schema version", () => {
    for (
      let sourceVersion = LAUNCH_SAVE_SCHEMA_VERSION;
      sourceVersion < CURRENT_SAVE_SCHEMA_VERSION;
      sourceVersion += 1
    ) {
      expect(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION[sourceVersion]).toBeTypeOf("function");
    }
  });

  it.each(Object.entries(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION))(
    "stamps version %s fixtures idempotently",
    (_version, createFixture) => {
      const once = normalizeSaveData(createFixture());
      const twice = normalizeSaveData(migrateSaveDataToCurrent(once));
      expect(twice).toEqual(once);
      expect(once.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    },
  );

  it.each(Object.entries(MIGRATION_SCENARIO_FIXTURES))("stamps scenario %s idempotently", (_name, createFixture) => {
    const once = normalizeSaveData(createFixture());
    const twice = normalizeSaveData(migrateSaveDataToCurrent(once));
    expect(twice).toEqual(once);
    expect(once.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("preserves wildwood draft reward state in current-schema fixtures", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodTrinketReward());
    expect(migrated.activeRun?.contentSystemType).toBe("wildwood");
    expect(migrated.activeRun?.wildwoodDraft?.rewardType).toBe("trinket");
    expect(migrated.activeRun?.wildwoodDraft?.phase).toBe("reward");
  });

  it("preserves campaign progress fields in current-schema fixtures", () => {
    const campaign = normalizeSaveData(currentSchemaCampaignSave());
    expect(campaign.activeRun?.runGold).toBe(42);
    expect(campaign.talentXP.physical).toBe(18);

    const midCombat = normalizeSaveData(currentSchemaMidCombatTrinketSave());
    expect(midCombat.activeRun?.activeCombat?.battleState.trinketEffects.boneCharmHealOnKill).toBe(3);
    expect(midCombat.activeRun?.activeCombat?.battleState.flags.firstBurnTrinketDoubledUsed).toBe(true);
    expect(midCombat.activeRun?.runTrinkets).toEqual(["meteorite", "bone-charm"]);
  });

  it("does not drop wildwood active runs during migration", () => {
    for (const createFixture of [
      ...Object.values(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION),
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

  it("references only catalog or tombstoned card IDs in migrated fixtures", () => {
    const cardIds = new Set(cardLibrary.map((c) => c.id));

    const fixtures = [
      ...Object.values(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION),
      ...Object.values(MIGRATION_SCENARIO_FIXTURES),
    ];
    const offenders: string[] = [];
    for (const createFixture of fixtures) {
      const migrated = normalizeSaveData(createFixture());

      for (const id of migrated.discoveredCardIds ?? []) {
        if (!cardIds.has(id) && !TOMBSTONED_CARD_IDS.has(id)) offenders.push(`discoveredCardIds: ${id}`);
      }
    }
    expect(offenders, "Add tombstoned entries for unknown IDs, or fix the migration chain.").toEqual([]);
  });
});
