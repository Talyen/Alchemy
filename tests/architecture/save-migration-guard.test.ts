import { savedActivityFixture, savedActivityData } from "../fixtures/run-activity";
import { describe, expect, it } from "vitest";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage/save-candidates";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION, SaveDataSchema } from "@/lib/validation";
import { createCompleteActiveRunData } from "../features/alchemy/shared/stores/session/active-run-data-fixture";
import { currentSchemaCampaignSave, currentSchemaMysterySave } from "../fixtures/current-saves";

describe("supported save baseline", () => {
  it("keeps a current Mystery offer even when its choices differ from the live pool", () => {
    const saved = currentSchemaMysterySave();
    const loaded = evaluateSaveCandidates([JSON.stringify(saved)]);
    expect(savedActivityData(loaded.data.activeRun, "mystery")?.event).toEqual(
      savedActivityData(saved.activeRun, "mystery")?.event,
    );
    expect(loaded.data.gold).toBe(saved.gold);
  });

  it("drops a malformed Mystery offer without discarding the run", () => {
    const current = currentSchemaMysterySave();
    const saved = {
      ...current,
      activeRun: {
        ...current.activeRun,
        activity: savedActivityFixture("mystery", {
          ...savedActivityData(current.activeRun, "mystery")!,
          event: { id: "fairy-ring", choices: "invalid" },
        }),
      },
    };

    const loaded = evaluateSaveCandidates([JSON.stringify(saved)]);
    expect(loaded.data.activeRun).not.toBeNull();
    expect(savedActivityData(loaded.data.activeRun, "mystery")).toBeNull();
  });

  it.each([0, 18, 19, 20])("rejects disposable schema %s before permissive defaults", (saveSchemaVersion) => {
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
    expect(savedActivityData(second.activeRun, "battle")).not.toBeNull();
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
