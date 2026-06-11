import { describe, expect, it } from "vitest";
import { pickNewerSavePayload } from "@/lib/validation/save-merge";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";

function save(overrides: Record<string, unknown>) {
  return JSON.stringify({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    lastSavedAt: 0,
    ...overrides,
  });
}

describe("pickNewerSavePayload", () => {
  it("prefers higher schema version", () => {
    const local = save({ saveSchemaVersion: 2, lastSavedAt: 999 });
    const cloud = save({ saveSchemaVersion: 3, lastSavedAt: 1 });
    expect(pickNewerSavePayload(local, cloud)).toBe(cloud);
  });

  it("prefers newer lastSavedAt when schema versions match", () => {
    const local = save({ lastSavedAt: 100 });
    const cloud = save({ lastSavedAt: 200 });
    expect(pickNewerSavePayload(local, cloud)).toBe(cloud);
  });

  it("keeps local when timestamps tie and both are non-zero", () => {
    const local = save({ lastSavedAt: 50 });
    const cloud = save({ lastSavedAt: 50 });
    expect(pickNewerSavePayload(local, cloud)).toBe(local);
  });

  it("prefers cloud when legacy saves tie at lastSavedAt 0", () => {
    const local = save({ lastSavedAt: 0, discoveredCardIds: ["slash"] });
    const cloud = save({ lastSavedAt: 0, discoveredCardIds: ["slash", "block"] });
    expect(pickNewerSavePayload(local, cloud)).toBe(cloud);
  });
});
