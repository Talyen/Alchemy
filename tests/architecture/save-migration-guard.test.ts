import { describe, expect, it } from "vitest";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage/save-candidates";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION, SaveDataSchema } from "@/lib/validation";
import { createCompleteActiveRunData } from "../features/alchemy/shared/stores/active-run-data-fixture";
import { currentSchemaCampaignSave } from "../fixtures/current-saves";

describe("supported save baseline", () => {
  it.each([0, 11, 18])("rejects disposable schema %s before permissive defaults", (saveSchemaVersion) => {
    const raw = { ...currentSchemaCampaignSave(), saveSchemaVersion, gold: 999, lastSavedAt: 500 };
    const loaded = evaluateSaveCandidates([JSON.stringify(raw)]);
    expect(loaded.status.kind).toBe("corrupt");
    expect(loaded.data.activeRun).toBeNull();
    expect(loaded.data.gold).toBe(0);
  });

  it("selects a supported backup instead of a fresher below-baseline payload", () => {
    const current = { ...currentSchemaCampaignSave(), lastSavedAt: 100 };
    const old = { ...current, saveSchemaVersion: LAUNCH_SAVE_SCHEMA_VERSION - 1, lastSavedAt: 200 };
    const loaded = evaluateSaveCandidates([JSON.stringify(old), JSON.stringify(current)]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.gold).toBe(42);
    expect(loaded.data.lastSavedAt).toBe(100);
  });

  it("round-trips current battle results, map progress and RNG without re-resolving them", () => {
    const first = SaveDataSchema.parse({ ...createDefaultSaveData(), activeRun: createCompleteActiveRunData() });
    const second = SaveDataSchema.parse(JSON.parse(JSON.stringify(first)));
    expect(second).toEqual(first);
    expect(second.activeRun).not.toBeNull();
    expect(second.activeRun?.activeCombat).not.toBeNull();
    expect(second).not.toHaveProperty("parkedRuns");
    expect(second).not.toHaveProperty("runRecency");
  });

  it("repairs an unusable current run without discarding valid profile progress", () => {
    const loaded = evaluateSaveCandidates([
      JSON.stringify({ ...currentSchemaCampaignSave(), activeRun: { characterId: "invalid" } }),
    ]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.activeRun).toBeNull();
    expect(loaded.data.gold).toBe(42);
    expect(loaded.data.talentXP.physical).toBe(18);
    expect(loaded.data.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });
});
