import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LEGACY_ARMORY_POSITIONS_STORAGE_KEY,
  migrateV9ToV10,
  readLegacyArmoryBoardPositionsFromStorage,
} from "@/lib/validation/migration/steps";

const mockStorage: Record<string, string> = {};
const globalWithWindow = globalThis as typeof globalThis & { window?: { localStorage: Storage } };

function setupLocalStorage() {
  globalWithWindow.window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const key of Object.keys(mockStorage)) delete mockStorage[key];
      },
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      get length() {
        return Object.keys(mockStorage).length;
      },
    } as Storage,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  setupLocalStorage();
});

afterEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
});

function setStoredValue(key: string, value: string | null) {
  if (value === null) {
    delete mockStorage[key];
  } else {
    mockStorage[key] = value;
  }
}

describe("readLegacyArmoryBoardPositionsFromStorage", () => {
  it("returns an empty object when no legacy key is set", () => {
    expect(readLegacyArmoryBoardPositionsFromStorage()).toEqual({});
  });

  it("parses stored JSON, removes the key, and returns the parsed positions", () => {
    const stored = {
      "helm-1": { col: 1, row: 1 },
      "ring-1": { col: 4, row: 2 },
    };
    setStoredValue(LEGACY_ARMORY_POSITIONS_STORAGE_KEY, JSON.stringify(stored));

    expect(readLegacyArmoryBoardPositionsFromStorage()).toEqual(stored);
    expect(mockStorage[LEGACY_ARMORY_POSITIONS_STORAGE_KEY]).toBeUndefined();
  });

  it("returns an empty object when the stored JSON is invalid", () => {
    setStoredValue(LEGACY_ARMORY_POSITIONS_STORAGE_KEY, "{not json");
    expect(readLegacyArmoryBoardPositionsFromStorage()).toEqual({});
  });

  it("returns an empty object when the stored JSON is not a plain object", () => {
    setStoredValue(LEGACY_ARMORY_POSITIONS_STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(readLegacyArmoryBoardPositionsFromStorage()).toEqual({});
  });
});

describe("migrateV9ToV10", () => {
  it("bumps the schema version when no legacy positions are present", () => {
    const result = migrateV9ToV10({ saveSchemaVersion: 9 });
    expect(result.saveSchemaVersion).toBe(10);
  });

  it("merges legacy positions into the knight's board positions", () => {
    setStoredValue(
      LEGACY_ARMORY_POSITIONS_STORAGE_KEY,
      JSON.stringify({ "helm-1": { col: 1, row: 1 }, "ring-1": { col: 4, row: 2 } }),
    );

    const result = migrateV9ToV10({
      saveSchemaVersion: 9,
      gearBoardPositionsByCharacter: { knight: {}, rogue: {} },
    });

    expect(result.gearBoardPositionsByCharacter).toMatchObject({
      knight: {
        "helm-1": { col: 1, row: 1 },
        "ring-1": { col: 4, row: 2 },
      },
      rogue: {},
    });
    expect(result.saveSchemaVersion).toBe(10);
    expect(mockStorage[LEGACY_ARMORY_POSITIONS_STORAGE_KEY]).toBeUndefined();
  });

  it("preserves existing knight positions when merging legacy positions", () => {
    setStoredValue(
      LEGACY_ARMORY_POSITIONS_STORAGE_KEY,
      JSON.stringify({ "helm-1": { col: 1, row: 1 } }),
    );

    const result = migrateV9ToV10({
      saveSchemaVersion: 9,
      gearBoardPositionsByCharacter: {
        knight: { "helm-1": { col: 3, row: 3 } },
        rogue: {},
      },
    });

    expect(result.gearBoardPositionsByCharacter).toMatchObject({
      knight: { "helm-1": { col: 3, row: 3 } },
    });
  });

  it("creates a gearBoardPositionsByCharacter object when one is absent", () => {
    setStoredValue(
      LEGACY_ARMORY_POSITIONS_STORAGE_KEY,
      JSON.stringify({ "helm-1": { col: 1, row: 1 } }),
    );

    const result = migrateV9ToV10({ saveSchemaVersion: 9 });

    expect(result.gearBoardPositionsByCharacter).toEqual({
      knight: { "helm-1": { col: 1, row: 1 } },
    });
    expect(result.saveSchemaVersion).toBe(10);
  });
});
