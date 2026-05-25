import { describe, expect, it } from "vitest";
import {
  migrateSaveDataToCurrent,
  getRawSaveSchemaVersion,
  getRawContentVersion,
  isUnsupportedFutureSaveData,
  isUnsupportedFutureContentData,
} from "@/lib/validation/migration";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from "@/lib/validation/metadata";

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
  });

  it("returns the version when valid", () => {
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: 1 })).toBe(1);
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

  it("preserves existing fields during v0→v1 migration", () => {
    const result = migrateSaveDataToCurrent({ musicVolume: 75, activeRun: null });
    expect(result.musicVolume).toBe(75);
    expect(result.activeRun).toBeNull();
    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("adds default gameBuildVersion when missing", () => {
    const result = migrateSaveDataToCurrent({});
    expect(typeof result.gameBuildVersion).toBe("string");
  });

  it("preserves existing gameBuildVersion", () => {
    const result = migrateSaveDataToCurrent({ gameBuildVersion: "0.2.0-test" });
    expect(result.gameBuildVersion).toBe("0.2.0-test");
  });

  it("normalizes contentVersion to current when invalid", () => {
    const result = migrateSaveDataToCurrent({ contentVersion: -1 });
    expect(result.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  });

  it("normalizes contentVersion to current when non-numeric", () => {
    const result = migrateSaveDataToCurrent({ contentVersion: "old" });
    expect(result.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  });

  it("migration chain length matches CURRENT_SAVE_SCHEMA_VERSION", () => {
    const result = migrateSaveDataToCurrent({});
    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });
});

describe("legacy resolution→aspect ratio migration", () => {
  it("converts '1920x1080' to '16:9'", () => {
    const result = migrateSaveDataToCurrent({ selectedResolution: "1920x1080" });
    expect(result.selectedAspectRatio).toBe("16:9");
  });

  it("converts '1920x1200' to '16:10'", () => {
    const result = migrateSaveDataToCurrent({ selectedResolution: "1920x1200" });
    expect(result.selectedAspectRatio).toBe("16:10");
  });

  it("converts '2560x1080' to '21:9'", () => {
    const result = migrateSaveDataToCurrent({ selectedResolution: "2560x1080" });
    expect(result.selectedAspectRatio).toBe("21:9");
  });

  it("preserves existing selectedAspectRatio even if selectedResolution is set", () => {
    const result = migrateSaveDataToCurrent({ selectedResolution: "1920x1080", selectedAspectRatio: "16:10" });
    expect(result.selectedAspectRatio).toBe("16:10");
  });

  it("does not add selectedAspectRatio for unknown resolution", () => {
    const result = migrateSaveDataToCurrent({ selectedResolution: "800x600" });
    expect(result.selectedAspectRatio).toBeUndefined();
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
