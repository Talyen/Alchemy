import { describe, expect, it } from "vitest";
import {
  getRawSaveSchemaVersion,
  getRawContentVersion,
  isUnsupportedFutureSaveData,
  isUnsupportedFutureContentData,
} from "@/lib/validation/migration";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from "@/lib/validation";

describe("raw version readers", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string", "string"],
    ["number", 42],
    ["missing version", {}],
    ["negative version", { saveSchemaVersion: -1, contentVersion: -5 }],
    ["non-integer version", { saveSchemaVersion: 1.5 }],
    ["NaN version", { saveSchemaVersion: NaN }],
    ["infinite version", { saveSchemaVersion: Infinity }],
  ])("returns 0 for %s", (_label, input) => {
    expect(getRawSaveSchemaVersion(input)).toBe(0);
    expect(getRawContentVersion(input)).toBe(0);
  });

  it("returns the version when valid", () => {
    expect(getRawSaveSchemaVersion({ saveSchemaVersion: 5 })).toBe(5);
    expect(getRawContentVersion({ contentVersion: CURRENT_CONTENT_VERSION })).toBe(CURRENT_CONTENT_VERSION);
  });
});

describe("future version gates", () => {
  it.each([
    ["current schema", { saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION }, false],
    ["older schema", { saveSchemaVersion: 0 }, false],
    ["newer schema", { saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 }, true],
    ["malformed", null, false],
  ])("schema gate returns %s -> %s", (_label, input, expected) => {
    expect(isUnsupportedFutureSaveData(input)).toBe(expected);
  });

  it.each([
    ["current content", { contentVersion: CURRENT_CONTENT_VERSION }, false],
    ["newer content", { contentVersion: CURRENT_CONTENT_VERSION + 1 }, true],
    ["malformed", null, false],
  ])("content gate returns %s -> %s", (_label, input, expected) => {
    expect(isUnsupportedFutureContentData(input)).toBe(expected);
  });
});
