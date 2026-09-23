import { loadAlchemySaveState, saveAlchemySaveData } from "@/features/alchemy/shared/storage";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { configureSaveBackend } from "@/features/alchemy/shared/storage/io";
import { SAVE_KEY } from "@/lib/game-constants";
import { SAVE_RECOVERY_KEY } from "@/lib/game-constants";
import { defaultBattleState } from "@/lib/battle";
import { emptyInventory } from "@/lib/homestead/inventory";
import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentSchemaCampaignSave } from "../../../../fixtures/current-saves";
import {
  setupMockWindowBrowser,
  setupMockWindowDesktop,
  teardownMockWindow,
} from "../../../../helpers/desktop-save-mock-helper";
import {
  futureContentSaveCandidate,
  futureSaveCandidate,
  playableSaveCandidate,
} from "../../../../helpers/save-candidate-fixtures";
import { installStorageIoTestHooks } from "../../../../helpers/storage-io-test-setup";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
} as Storage;

installStorageIoTestHooks();

function setupDesktopSaveCandidates(candidates: string[]) {
  const desktop = setupMockWindowDesktop({ saveCandidates: candidates, steamName: null });
  return { writeSave: desktop.writeSave };
}

const futureSaveCases = [
  {
    label: "newer schema",
    payload: futureSaveCandidate(2000, { discoveredCardIds: ["future-card"] }),
    expectedStatus: {
      kind: "unsupported-newer-schema" as const,
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    },
  },
  {
    label: "newer content",
    payload: futureContentSaveCandidate(2000, { discoveredCardIds: ["future-card"] }),
    expectedStatus: {
      kind: "unsupported-newer-content" as const,
      detectedContentVersion: CURRENT_CONTENT_VERSION + 1,
    },
  },
];
describe("storage io", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    setupMockWindowBrowser(mockLocalStorage);
  });

  afterEach(() => {
    teardownMockWindow();
  });

  it("loadAlchemySaveState returns defaults when localStorage empty", async () => {
    const data = (await loadAlchemySaveState()).data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect(data.activeRun).toBeNull();
  });

  it.each(["reported", "thrown"])("protects the save after a %s backend read failure", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Storage unavailable");
    const write = vi.fn().mockResolvedValue({ ok: true });
    configureSaveBackend({
      readCandidates: async () => {
        if (failure === "thrown") throw error;
        return { ok: false, error };
      },
      write,
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    });

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("unavailable");
    expect(loaded.data).toEqual(defaultSaveData);
    expect(await saveAlchemySaveData(defaultSaveData)).toBe("saved");
    expect(write).toHaveBeenCalledWith(SAVE_RECOVERY_KEY, expect.any(String));
  });

  it("warns when a card effect is corrupt but the rest of the save loads", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const campaign = currentSchemaCampaignSave();
    const activeRun = campaign.activeRun as { runDeck: Array<Record<string, unknown>> } | null;
    if (!activeRun) throw new Error("campaign fixture is missing activeRun");
    mockStorage[SAVE_KEY] = JSON.stringify({
      ...campaign,
      activeRun: {
        ...activeRun,
        runDeck: [
          {
            ...activeRun.runDeck[0],
            effects: [{ kind: "not-a-real-effect" }],
          },
        ],
      },
    });
    const loaded = await loadAlchemySaveState();
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : undefined).toEqual(
      expect.arrayContaining([expect.stringMatching(/Card content "effects\[0\]" was repaired/)]),
    );
    expect(loaded.data.activeRun?.runDeck[0]?.id).toBe("slash");
    expect(loaded.data.activeRun?.runDeck[0]?.effects.length).toBeGreaterThan(0);
  });

  it("loadAlchemySaveState returns defaults on corrupt JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = "not-json";
    const data = (await loadAlchemySaveState()).data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect((await loadAlchemySaveState()).status.kind).toBe("corrupt");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Save candidate JSON parse failed"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("returns corrupt for a non-object JSON root", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = "null";
    const loaded = await loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status.kind).toBe("corrupt");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Save candidate root was not an object"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("loadAlchemySaveState loads valid save data", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50, sfxVolume: 50 });
    const data = (await loadAlchemySaveState()).data;
    expect(data.musicVolume).toBe(50);
  });

  it("loadAlchemySaveState loads campaign fixture from localStorage", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify(currentSchemaCampaignSave());
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(loaded.data.selectedAspectRatio).toBe("auto");
    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block", "bash"]);
    expect(loaded.data.activeRun).toMatchObject({
      characterId: "knight",
      runPlayerHealth: 18,
      contentSystemType: "campaign",
    });
    expect(loaded.data.activeRun).not.toHaveProperty("runGold");
    expect(loaded.data.gold).toBe(42);
    expect(loaded.data.materialInventory).toEqual({ ...emptyInventory(), wood: 4, iron: 2 });

    await saveAlchemySaveData(loaded.data);
    const reloaded = JSON.parse(mockStorage[SAVE_KEY]);
    expect(reloaded.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(reloaded.discoveredCardIds).toEqual(["slash", "block", "bash"]);
    expect(reloaded.activeRun).not.toHaveProperty("runGold");
    expect(reloaded.gold).toBe(42);
  });

  it("does not report warnings for harmless save defaults", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION, musicVolume: 50 });
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toBeUndefined();
  });

  it("reports warnings when corrupt gear sections reset to empty defaults", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: "corrupt",
      ownedTrinketIds: [123],
      craftingCurrencies: "corrupt",
      materialInventory: "corrupt",
    });
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    const warnings = loaded.status.kind === "ok" ? (loaded.status.warnings ?? []) : [];
    expect(warnings).toContain("gear collection could not be fully restored");
    expect(warnings).toContain("owned trinkets could not be fully restored");
    expect(warnings).toContain("crafting currencies could not be fully restored");
    expect(warnings).toContain("homestead materials could not be fully restored");
  });

  it("reports warnings when an active run cannot be restored and allows writes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      activeRun: {
        characterId: "bard",
        runDeck: [],
        runGold: 0,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        roomsEncountered: 1,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runBoons: [],
        selectedDifficulty: null,
        contentSystemType: "campaign",
        labyrinthMap: null,
      },
    });
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toContain("active run could not be restored");

    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY]).discoveredCardIds).toEqual(["slash"]);
    expect(JSON.parse(mockStorage[SAVE_KEY]).activeRun).toBeNull();
  });

  it.each([
    { label: "missing", enemy: undefined },
    { label: "unknown", enemy: { id: "missing-enemy" } },
  ])("keeps the run and warns when a battle has a $label enemy", async ({ enemy }) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const campaign = currentSchemaCampaignSave();
    const activeRun = (campaign as Record<string, unknown>).activeRun;
    if (!activeRun || typeof activeRun !== "object" || Array.isArray(activeRun)) {
      throw new Error("campaign fixture is missing activeRun");
    }
    mockStorage[SAVE_KEY] = JSON.stringify({
      ...campaign,
      activeRun: {
        ...activeRun,
        activeCombat: { battleState: { ...defaultBattleState(), currentEnemy: enemy } },
      },
    });

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.activeRun).not.toBeNull();
    expect(loaded.data.activeRun?.activeCombat).toBeNull();
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toContain("battle could not be restored");
  });

  it.each(futureSaveCases)("saves new browser progress beside $label", async ({ payload, expectedStatus }) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = payload;

    const loaded = await loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status).toEqual(expectedStatus);
    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(mockStorage[SAVE_KEY]).toBe(payload);
    expect(JSON.parse(mockStorage[SAVE_RECOVERY_KEY]).discoveredCardIds).toEqual(["slash"]);
  });

  it("resumes a recovery save on the next load without changing the newer primary", async () => {
    const newerPrimary = futureSaveCandidate(2000);
    mockStorage[SAVE_KEY] = newerPrimary;

    expect((await loadAlchemySaveState()).status.kind).toBe("unsupported-newer-schema");
    expect(await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] })).toBe("saved");

    const resumed = await loadAlchemySaveState();
    expect(resumed.status.kind).toBe("ok");
    expect(resumed.data.discoveredCardIds).toEqual(["slash"]);
    expect(mockStorage[SAVE_KEY]).toBe(newerPrimary);
  });

  it.each(futureSaveCases)(
    "loads a compatible backup and saves beside a desktop $label primary",
    async ({ payload }) => {
      const compatibleBackup = playableSaveCandidate(1000);
      const { writeSave } = setupDesktopSaveCandidates([payload, compatibleBackup]);

      const loaded = await loadAlchemySaveState();

      expect(loaded.status.kind).toBe("ok");
      expect(loaded.data.lastSavedAt).toBe(1000);
      await saveAlchemySaveData(loaded.data);
      expect(writeSave).toHaveBeenCalledWith(expect.any(String), "recovery");
      expect(writeSave).not.toHaveBeenCalledWith(expect.any(String), undefined);
    },
  );

  it("uses a compatible backup after a corrupt local candidate while retaining a future backup", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const futureBackup = futureSaveCandidate(2000);
    const compatibleOlderBackup = playableSaveCandidate(1000);
    const { writeSave } = setupDesktopSaveCandidates(["not-valid-json", futureBackup, compatibleOlderBackup]);

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.lastSavedAt).toBe(1000);
    await saveAlchemySaveData(loaded.data);
    expect(writeSave).toHaveBeenCalledWith(expect.any(String), "recovery");
  });

  it("uses a compatible authoritative save without inspecting a future fallback", async () => {
    const compatibleSave = playableSaveCandidate(0);
    const futureBackup = futureSaveCandidate(undefined);
    const { writeSave } = setupDesktopSaveCandidates([compatibleSave, futureBackup]);

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
    await saveAlchemySaveData(loaded.data);
    expect(writeSave).toHaveBeenCalledOnce();
  });

  it("walks backup.1 when local is corrupt on desktop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const validFromBackup = playableSaveCandidate(0, { discoveredCardIds: ["slash", "block"] });
    const corruptLocal = "not-valid-json";

    setupMockWindowDesktop({ saveCandidates: [corruptLocal, validFromBackup], steamName: null });

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
  });

  it("does not request a desktop backup on load (rotation owns backups at write time)", async () => {
    const legacy = JSON.stringify(currentSchemaCampaignSave());
    const desktop = setupMockWindowDesktop({ saveCandidates: [legacy] });

    await loadAlchemySaveState();

    expect(desktop.writeSave).not.toHaveBeenCalled();
  });

  it("returns corrupt when every candidate fails JSON parsing on desktop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    setupMockWindowDesktop({ saveCandidates: ["garbage", "also-garbage"], steamName: null });

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("corrupt");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Save candidate JSON parse failed"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
