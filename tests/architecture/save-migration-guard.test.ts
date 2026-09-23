import { describe, expect, it } from "vitest";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage/save-candidates";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION, SaveDataSchema } from "@/lib/validation";
import { createCompleteActiveRunData } from "../features/alchemy/shared/stores/active-run-data-fixture";
import { currentSchemaCampaignSave, version19MysterySave } from "../fixtures/current-saves";

describe("supported save baseline", () => {
  it("keeps a removed version 19 Mystery visit marked for destination recovery", () => {
    const saved = version19MysterySave();
    const loaded = evaluateSaveCandidates([
      JSON.stringify({
        ...saved,
        activeRun: {
          ...saved.activeRun,
          currentScreen: null,
          mysteryVisit: { ...saved.activeRun.mysteryVisit, eventId: "removed-mystery-event" },
        },
      }),
    ]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.activeRun?.currentScreen).toBe("mystery");
    expect(loaded.data.activeRun?.mysteryVisit).toBeNull();
  });

  it("loads a version 19 Mystery offer with its resolved Boon and Labyrinth reward", () => {
    const loaded = evaluateSaveCandidates([JSON.stringify(version19MysterySave())]);
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    const event = loaded.data.activeRun?.mysteryVisit?.event;
    expect(event?.id).toBe("fairy-ring");
    expect(event?.choices[0]?.effects).toContainEqual(
      expect.objectContaining({ kind: "gainGeneratedGear", astral: true }),
    );
    expect(event?.choices[0]?.effects).toContainEqual({ kind: "gainGold", amount: 40 });
    expect(event?.choices[1]?.effects).toContainEqual({ kind: "gainTrinket", trinketId: "parasitic-bloom" });
  });

  it("keeps a current Mystery offer even when its choices differ from the live pool", () => {
    const migrated = evaluateSaveCandidates([JSON.stringify(version19MysterySave())]).data;
    const visit = migrated.activeRun?.mysteryVisit;
    if (!migrated.activeRun || !visit) throw new Error("Mystery migration fixture did not load");
    const offered = {
      ...visit.event,
      choices: [{ label: "Saved offer", effects: [{ kind: "gainGold" as const, amount: 7 }] }],
    };
    const saved = {
      ...migrated,
      activeRun: { ...migrated.activeRun, mysteryVisit: { ...visit, event: offered } },
    };

    const loaded = evaluateSaveCandidates([JSON.stringify(saved)]);
    expect(loaded.data.activeRun?.mysteryVisit?.event).toEqual(offered);
    expect(loaded.data.gold).toBe(migrated.gold);
  });

  it("drops a malformed Mystery offer without discarding the run", () => {
    const migrated = evaluateSaveCandidates([JSON.stringify(version19MysterySave())]).data;
    if (!migrated.activeRun) throw new Error("Mystery migration fixture did not load");
    const saved = {
      ...migrated,
      activeRun: {
        ...migrated.activeRun,
        mysteryVisit: { ...migrated.activeRun.mysteryVisit, event: { id: "fairy-ring", choices: "invalid" } },
      },
    };

    const loaded = evaluateSaveCandidates([JSON.stringify(saved)]);
    expect(loaded.data.activeRun).not.toBeNull();
    expect(loaded.data.activeRun?.mysteryVisit).toBeNull();
  });

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
