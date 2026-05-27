import { describe, expect, it } from "vitest";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation/metadata";
import { migrateSaveDataToCurrent } from "@/lib/validation/migration";
import { legacyCampaignRunSave } from "../../fixtures/legacy-saves";

describe("validation metadata", () => {
  it("CURRENT_SAVE_SCHEMA_VERSION matches migrated legacy save version", () => {
    const migrated = migrateSaveDataToCurrent(legacyCampaignRunSave());
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("exposes stable game and content version constants", () => {
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    expect(CURRENT_GAME_BUILD_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CURRENT_CONTENT_VERSION).toBeGreaterThanOrEqual(1);
  });
});
