import { describe, expect, it } from "vitest";
import {
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation/metadata";
import { SaveDataSchema } from "@/lib/validation";
import { currentSchemaCampaignSave } from "../../fixtures/current-saves";

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
