import { describe, expect, it } from "vitest";
import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage/io";

function playableSave(lastSavedAt: number) {
  return JSON.stringify({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    lastSavedAt,
    discoveredCardIds: ["slash"],
    activeRun: null,
  });
}

function futureSave(lastSavedAt: number | undefined) {
  return JSON.stringify({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...(lastSavedAt === undefined ? {} : { lastSavedAt }),
    discoveredCardIds: ["slash"],
    activeRun: null,
  });
}

describe("save version protection", () => {
  it("protects the session when the newer-version copy arrives after the playable backup", () => {
    const loaded = evaluateSaveCandidates([playableSave(1000), futureSave(2000)]);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-schema",
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
  });

  it("loads a fresher playable backup listed before a stale newer-version copy", () => {
    const loaded = evaluateSaveCandidates([playableSave(2000), futureSave(1000)]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
    expect(loaded.data.lastSavedAt).toBe(2000);
  });

  it("protects the session when the newer-version copy is genuinely newer", () => {
    const loaded = evaluateSaveCandidates([playableSave(1000), futureSave(2000)]);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-schema",
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
  });

  it("loads the playable backup past a newer-version stub with no timestamp", () => {
    const loaded = evaluateSaveCandidates([playableSave(2000), futureSave(undefined)]);
    expect(loaded.status.kind).toBe("ok");
  });

  it("protects the session when only a newer-version copy exists", () => {
    const loaded = evaluateSaveCandidates([futureSave(1000)]);
    expect(loaded.status.kind).toBe("unsupported-newer-schema");
  });

  it("loads the playable backup on a timestamp tie", () => {
    const loaded = evaluateSaveCandidates([playableSave(1000), futureSave(1000)]);
    expect(loaded.status.kind).toBe("ok");
  });

  it("protects the session on newer content versions", () => {
    const loaded = evaluateSaveCandidates([
      JSON.stringify({
        saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
        contentVersion: CURRENT_CONTENT_VERSION + 1,
        lastSavedAt: 1000,
        activeRun: null,
      }),
    ]);
    expect(loaded.status.kind).toBe("unsupported-newer-content");
  });

  it("loads the freshest playable backup regardless of candidate order", () => {
    const stale = playableSave(1000);
    const fresh = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      lastSavedAt: 2000,
      discoveredCardIds: ["slash", "block"],
      activeRun: null,
    });
    expect(evaluateSaveCandidates([stale, fresh]).data.lastSavedAt).toBe(2000);
    expect(evaluateSaveCandidates([fresh, stale]).data.lastSavedAt).toBe(2000);
    expect(evaluateSaveCandidates([fresh, stale]).data.discoveredCardIds).toEqual(["slash", "block"]);
  });

  it("reports the newest future candidate when several future copies exist", () => {
    const olderFutureHigherVersion = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 2,
      contentVersion: CURRENT_CONTENT_VERSION,
      lastSavedAt: 1000,
      activeRun: null,
    });
    const newerFutureLowerVersion = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
      contentVersion: CURRENT_CONTENT_VERSION,
      lastSavedAt: 2000,
      activeRun: null,
    });
    const loaded = evaluateSaveCandidates([newerFutureLowerVersion, olderFutureHigherVersion]);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-schema",
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
  });
});
