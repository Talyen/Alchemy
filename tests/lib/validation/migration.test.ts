import { describe, expect, it } from "vitest";
import {
  migrateSaveDataToCurrent,
  getRawSaveSchemaVersion,
  getRawContentVersion,
  isUnsupportedFutureSaveData,
  isUnsupportedFutureContentData,
} from "@/lib/validation/migration";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from "@/lib/validation/metadata";
import {
  currentSchemaCampaignSave,
  currentSchemaLabyrinthRunSave,
  currentSchemaCorruptedCardRunSave,
} from "../../fixtures/legacy-saves";

describe("getRawSaveSchemaVersion", () => {
  it("returns 0 for null/undefined input", () => {
    expect(getRawSaveSchemaVersion(null)).toBe(0);
    expect(getRawSaveSchemaVersion(undefined)).toBe(0);
  });

  it("returns 0 for non-object input", () => {
    expect(getRawSaveSchemaVersion("string")).toBe(0);
    expect(getRawSaveSchemaVersion(42)).toBe(0);
  });

  it("returns 0 when version is missing", () => {
    expect(getRawSaveSchemaVersion({})).toBe(0);
  });

  it("returns 0 for negative version", () => {
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: -1 })).toBe(0);
  });

  it("returns 0 for non-integer version", () => {
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: 1.5 })).toBe(0);
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: NaN })).toBe(0);
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: Infinity })).toBe(0);
  });

  it("returns the version when valid", () => {
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: 1 })).toBe(1);
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: 5 })).toBe(5);
  });
});

describe("getRawContentVersion", () => {
  it("returns 0 for null input", () => {
    expect(getRawContentVersion(null)).toBe(0);
  });

  it("returns 0 when contentVersion is missing", () => {
    expect(getRawContentVersion({})).toBe(0);
  });

  it("returns 0 for negative content version", () => {
    expect(getRawContentVersion({ contentVersion: -5 })).toBe(0);
  });

  it("returns the version when valid", () => {
    expect(getRawContentVersion({ contentVersion: CURRENT_CONTENT_VERSION })).toBe(CURRENT_CONTENT_VERSION);
  });
});

describe("migrateSaveDataToCurrent", () => {
  it("returns an empty object for null input", () => {
    expect(migrateSaveDataToCurrent(null)).toEqual({});
  });

  it("sets saveSchemaVersion to current for v0 saves", () => {
    const result = migrateSaveDataToCurrent({});
    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("preserves existing fields while stamping the current schema version", () => {
    const result = migrateSaveDataToCurrent({ musicVolume: 75, activeRun: null });
    expect(result.musicVolume).toBe(75);
    expect(result.activeRun).toBeNull();
    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("stamps current schema version without reshaping gear inventories", () => {
    const inventories = { knight: [{ instanceId: "g1", definitionId: "leather-armor-basic", affixes: [] }] };
    const result = migrateSaveDataToCurrent({
      saveSchemaVersion: 9,
      gearInventories: inventories,
      gearLoadouts: {},
    });
    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(result.gearInventories).toEqual(inventories);
  });
});

describe("isUnsupportedFutureSaveData", () => {
  it("returns false for current version", () => {
    expect(isUnsupportedFutureSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION })).toBe(false);
  });

  it("returns false for older versions", () => {
    expect(isUnsupportedFutureSaveData({ saveSchemaVersion: 0 })).toBe(false);
  });

  it("returns true for newer versions", () => {
    expect(isUnsupportedFutureSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 })).toBe(true);
  });

  it("returns false for malformed input", () => {
    expect(isUnsupportedFutureSaveData(null)).toBe(false);
  });
});

describe("isUnsupportedFutureContentData", () => {
  it("returns false for current content version", () => {
    expect(isUnsupportedFutureContentData({ contentVersion: CURRENT_CONTENT_VERSION })).toBe(false);
  });

  it("returns true for newer content versions", () => {
    expect(isUnsupportedFutureContentData({ contentVersion: CURRENT_CONTENT_VERSION + 1 })).toBe(true);
  });

  it("returns false for malformed input", () => {
    expect(isUnsupportedFutureContentData(null)).toBe(false);
  });
});

describe("schema version stamping determinism", () => {
  it("campaign fixture stamps idempotently", () => {
    const first = migrateSaveDataToCurrent(currentSchemaCampaignSave());
    const second = migrateSaveDataToCurrent(first);
    expect(second).toEqual(first);
  });

  it("labyrinth fixture stamps idempotently", () => {
    const first = migrateSaveDataToCurrent(currentSchemaLabyrinthRunSave());
    const second = migrateSaveDataToCurrent(first);
    expect(second).toEqual(first);
  });

  it("corrupted-card fixture stamps idempotently", () => {
    const first = migrateSaveDataToCurrent(currentSchemaCorruptedCardRunSave());
    const second = migrateSaveDataToCurrent(first);
    expect(second).toEqual(first);
  });

  it("campaign fixture round-trips through JSON serialize", () => {
    const first = migrateSaveDataToCurrent(currentSchemaCampaignSave());
    const serialized = JSON.stringify(first);
    const deserialized = JSON.parse(serialized);
    const second = migrateSaveDataToCurrent(deserialized);
    expect(second).toEqual(first);
  });

  it("all scenario fixtures produce stable saveSchemaVersion", () => {
    const campaign = migrateSaveDataToCurrent(currentSchemaCampaignSave());
    const labyrinth = migrateSaveDataToCurrent(currentSchemaLabyrinthRunSave());
    const corrupted = migrateSaveDataToCurrent(currentSchemaCorruptedCardRunSave());
    expect(campaign.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(labyrinth.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(corrupted.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });
});
