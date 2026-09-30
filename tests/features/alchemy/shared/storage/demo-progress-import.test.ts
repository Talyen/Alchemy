import { makeRunCandidate } from "../../../../fixtures/active-run";
import { describe, expect, it, vi } from "vitest";
import {
  prepareDemoProgressImport,
  type DemoImportSource,
} from "@/features/alchemy/shared/storage/demo-progress-import";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { SaveStorage } from "@/features/alchemy/shared/storage/save-storage";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";

function source(candidates: string[]): DemoImportSource {
  return { initialized: false, fullSaveExists: false, readFailed: false, candidates };
}
describe("automatic demo progress import", () => {
  it("selects the freshest valid snapshot and keeps earned progress without adding snapshots together", () => {
    const older = { ...createDefaultSaveData(), gold: 100, lastSavedAt: 10 };
    const newer = {
      ...createDefaultSaveData(),
      activeRun: makeRunCandidate(),
      gold: 200,
      masterVolume: 9,
      lastSavedAt: 20,
      finishedRunCharacters: ["knight"],
      completedDifficulties: { knight: ["difficulty-1"] },
    };
    const result = prepareDemoProgressImport(source([JSON.stringify(older), JSON.stringify(newer)]));
    expect(result?.gold).toBe(200);
    expect(result?.finishedRunCharacters).toEqual(["knight"]);
    expect(result?.completedDifficulties.knight).toEqual([]);
    expect(result?.masterVolume).toBe(createDefaultSaveData().masterVolume);
    expect(result?.activeRun).toBeNull();
  });
  it.each(["initialized", "fullSaveExists", "readFailed"] as const)(
    "does not import when %s protects the profile",
    (flag) => {
      expect(
        prepareDemoProgressImport({ ...source([JSON.stringify(createDefaultSaveData())]), [flag]: true }),
      ).toBeNull();
    },
  );
  it("rejects corrupt and future sources", () => {
    expect(prepareDemoProgressImport(source(["invalid"]))).toBeNull();
    expect(
      prepareDemoProgressImport(
        source([JSON.stringify({ ...createDefaultSaveData(), saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 })]),
      ),
    ).toBeNull();
  });
  it("acknowledges the local import once even when initialization is requested concurrently", async () => {
    const write = vi.fn().mockResolvedValue({ ok: true });
    const receipt = vi.fn().mockResolvedValue(true);
    const storage = new SaveStorage({
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write,
      writeSync: () => null,
      clear: async () => ({ ok: true }),
      readDemoImportSource: async () => source([JSON.stringify({ ...createDefaultSaveData(), gold: 31 })]),
      completeDemoInitialization: receipt,
    });
    const [first, second] = await Promise.all([storage.load(), storage.load()]);
    expect(first.importedDemoProgress).toBe(true);
    expect(second.data.gold).toBe(31);
    expect(write).toHaveBeenCalledTimes(1);
    expect(receipt).toHaveBeenCalledTimes(1);
    await storage.clear();
    expect((await storage.load()).data.gold).toBe(0);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("does not announce a failed import or consume its source receipt", async () => {
    const receipt = vi.fn().mockResolvedValue(true);
    const storage = new SaveStorage({
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async () => ({ ok: false, error: new Error("disk full") }),
      writeSync: () => null,
      clear: async () => ({ ok: true }),
      readDemoImportSource: async () => source([JSON.stringify({ ...createDefaultSaveData(), gold: 31 })]),
      completeDemoInitialization: receipt,
    });
    expect((await storage.load()).importedDemoProgress).toBeUndefined();
    expect(receipt).not.toHaveBeenCalled();
  });
});
