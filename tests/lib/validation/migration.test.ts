import { describe, expect, it } from "vitest";
import {
  getRawSaveSchemaVersion,
  getRawContentVersion,
  isUnsupportedFutureSaveData,
  isUnsupportedFutureContentData,
} from "@/lib/validation/migration";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from "@/lib/validation";
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
