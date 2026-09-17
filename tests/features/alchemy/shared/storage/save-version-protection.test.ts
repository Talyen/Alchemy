import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import {
  futureContentSaveCandidate,
  futureSaveCandidate as futureSave,
  playableSaveCandidate as playableSave,
} from "../../../../helpers/save-candidate-fixtures";

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

  it("loads the playable backup past a newer-version stub with no timestamp", () => {
    const loaded = evaluateSaveCandidates([playableSave(2000), futureSave(undefined)]);
    expect(loaded.status.kind).toBe("ok");
  });

  it("protects the session when only a newer-version copy exists", () => {
    const loaded = evaluateSaveCandidates([futureSave(1000)]);
    expect(loaded.status.kind).toBe("unsupported-newer-schema");
  });

  it("protects the session when only a timestamp-less newer-version copy exists", () => {
    const loaded = evaluateSaveCandidates([futureSave(undefined)]);
    expect(loaded.status.kind).toBe("unsupported-newer-schema");
  });

  it("loads the playable backup on a timestamp tie", () => {
    const loaded = evaluateSaveCandidates([playableSave(1000), futureSave(1000)]);
    expect(loaded.status.kind).toBe("ok");
  });

  it("protects the session on newer content versions", () => {
    const loaded = evaluateSaveCandidates([futureContentSaveCandidate(1000)]);
    expect(loaded.status.kind).toBe("unsupported-newer-content");
  });

  it("loads the freshest playable backup regardless of candidate order", () => {
    const stale = playableSave(1000);
    const fresh = playableSave(2000, { discoveredCardIds: ["slash", "block"] });
    expect(evaluateSaveCandidates([stale, fresh]).data.lastSavedAt).toBe(2000);
    expect(evaluateSaveCandidates([fresh, stale]).data.lastSavedAt).toBe(2000);
    expect(evaluateSaveCandidates([fresh, stale]).data.discoveredCardIds).toEqual(["slash", "block"]);
  });

  it("loads the playable backup when only the build version differs", () => {
    const loaded = evaluateSaveCandidates([playableSave(1000, { gameBuildVersion: "0.0.0-test" })]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
  });

  it("keeps the first playable backup on a timestamp tie", () => {
    const first = playableSave(1000, { discoveredCardIds: ["slash"] });
    const second = playableSave(1000, { discoveredCardIds: ["block"] });
    expect(evaluateSaveCandidates([first, second]).data.discoveredCardIds).toEqual(["slash"]);
    expect(evaluateSaveCandidates([second, first]).data.discoveredCardIds).toEqual(["block"]);
  });

  it("floors fractional timestamps instead of resetting them to zero", () => {
    const loaded = evaluateSaveCandidates([playableSave(1000.9)]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.lastSavedAt).toBe(1000);
  });

  it("orders fractional playable timestamps by their floored value", () => {
    const floored = playableSave(1000.9);
    const lower = playableSave(999);
    expect(evaluateSaveCandidates([lower, floored]).data.lastSavedAt).toBe(1000);
    expect(evaluateSaveCandidates([floored, lower]).data.lastSavedAt).toBe(1000);
  });

  it("loads the playable backup on a fractional future-vs-playable tie", () => {
    const loaded = evaluateSaveCandidates([playableSave(1000.9), futureSave(1000)]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.lastSavedAt).toBe(1000);
  });

  it("reports the newest future candidate when several future copies exist", () => {
    const olderFutureHigherVersion = futureSave(1000, {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 2,
    });
    const newerFutureLowerVersion = futureSave(2000);
    const loaded = evaluateSaveCandidates([newerFutureLowerVersion, olderFutureHigherVersion]);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-schema",
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
  });
});

describe("save candidate error-sink silence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps routine empty and below-baseline candidates silent so browser journeys see zero errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = evaluateSaveCandidates([JSON.stringify({}), JSON.stringify({ activeRun: null })]);
    expect(loaded.status.kind).toBe("corrupt");
    expect(spy).not.toHaveBeenCalled();
  });

  it("still reports genuinely corrupt JSON through the error sink", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = evaluateSaveCandidates(["not-valid-json{{{"]);
    expect(loaded.status.kind).toBe("corrupt");
    expect(spy).toHaveBeenCalled();
  });
});
