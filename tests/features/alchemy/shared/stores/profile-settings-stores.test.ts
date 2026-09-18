import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { characters } from "@/lib/game-data";
import { profilePersistenceCodec, readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { resetProfileForTest } from "../../../../helpers/run-domain-store-test";
import {
  settingsPersistenceCodec,
  useAppSettings,
  useSelectedAspectRatio,
  useSettingsActions,
  useSettingsStore,
} from "@/features/alchemy/shared/stores/settings-store";
import { defaultSaveData, type SaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  handleCollectionTabChange,
  resetToDefaults,
  setCollectionPage,
  setDiscoveredCardIds,
} from "@/features/alchemy/shared/stores/run-session-write-port";

function makeSave(overrides: Partial<SaveData> = {}): SaveData {
  return { ...defaultSaveData, ...overrides };
}

beforeEach(() => {
  resetProfileForTest();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe("profile store", () => {
  it("owns persistent discoveries, completion, and collection view state", () => {
    const profile = readProfileStore();
    expect(profile.discoveredCardIds).toEqual([]);
    expect(profile.encounteredEnemyIds).toEqual([]);
    expect(profile.discoveredTrinketIds).toEqual([]);
    expect(profile.discoveredUniqueIds).toEqual([]);
    expect(profile.collectionTab).toBe("heroes");
    expect(profile.completedDifficulties.knight).toEqual([]);
  });

  it("hydrates only profile fields from save data", () => {
    dispatchRunSessionCommand((draft) =>
      profilePersistenceCodec.hydrate(
        makeSave({
          discoveredCardIds: ["card-a"],
          encounteredEnemyIds: ["goblin"],
          completedDifficulties: {
            ...defaultSaveData.completedDifficulties,
            knight: ["difficulty-1"],
          },
        }),
        draft,
      ),
    );

    const profile = readProfileStore();
    expect(profile.discoveredCardIds).toEqual(["card-a"]);
    expect(profile.encounteredEnemyIds).toEqual(["goblin"]);
    expect(profile.completedDifficulties.knight).toEqual(["difficulty-1"]);
  });

  it("supports functional discovery updates and collection navigation", () => {
    dispatchRunSessionCommand((draft) => {
      setDiscoveredCardIds(draft, (previous: string[]) => [...previous, "card-a"]);
      setCollectionPage(draft, "bestiary", 2);
      setCollectionPage(draft, "cards", -1);
      handleCollectionTabChange(draft, "bestiary");
    });

    expect(readProfileStore()).toMatchObject({
      discoveredCardIds: ["card-a"],
      collectionTab: "bestiary",
      collectionPages: { heroes: 0, cards: 0, bestiary: 2, trinkets: 0, uniques: 0 },
    });
  });

  it("resets persisted and transient profile state", () => {
    dispatchRunSessionCommand((draft) => {
      setDiscoveredCardIds(draft, ["card-a"]);
      handleCollectionTabChange(draft, "trinkets");
      resetToDefaults(draft);
    });

    expect(readProfileStore().discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(readProfileStore().collectionTab).toBe("heroes");
  });

  it("covers every character in the registry with completion buckets", () => {
    expect(Object.keys(readProfileStore().completedDifficulties).sort()).toEqual(Object.keys(characters).sort());
  });

  it("setState from getInitialState only writes data fields onto the aggregate", () => {
    resetProfileForTest();
    const encoded = profilePersistenceCodec.encode();
    expect(encoded).toEqual({
      discoveredCardIds: [],
      encounteredEnemyIds: [],
      discoveredTrinketIds: [],
      discoveredUniqueIds: [],
      completedDifficulties: expect.any(Object),
      finishedRunCharacters: [],
    });
    expect(readProfileStore()).not.toHaveProperty("setDiscoveredCardIds");
  });
});

describe("settings store", () => {
  it("owns display, audio, and gameplay preferences", () => {
    const settings = useSettingsStore.getState();
    expect(settings.selectedAspectRatio).toBe(defaultSaveData.selectedAspectRatio);
    expect(settings.displayMode).toBe(defaultSaveData.displayMode);
    expect(settings.showClearSaveConfirm).toBe(false);
  });

  it("hydrates only settings fields from save data", () => {
    settingsPersistenceCodec.hydrate(
      makeSave({
        selectedAspectRatio: "16:9",
        displayMode: "windowed",
        musicVolume: 50,
        sfxVolume: 80,
        masterVolume: 90,
        autoEndTurn: false,
      }),
    );

    expect(useSettingsStore.getState()).toMatchObject({
      selectedAspectRatio: "16:9",
      displayMode: "windowed",
      musicVolume: 50,
      sfxVolume: 80,
      masterVolume: 90,
      autoEndTurn: false,
    });
  });

  it("updates and resets preferences independently from profile state", () => {
    dispatchRunSessionCommand((draft) => setDiscoveredCardIds(draft, ["card-a"]));
    const settings = useSettingsStore.getState();
    settings.setBrightness(120);
    settings.setMasterVolume(75);
    settings.setShowClearSaveConfirm(true);
    settings.resetToDefaults();

    expect(useSettingsStore.getState().brightness).toBe(defaultSaveData.brightness);
    expect(useSettingsStore.getState().masterVolume).toBe(defaultSaveData.masterVolume);
    expect(useSettingsStore.getState().showClearSaveConfirm).toBe(false);
    expect(readProfileStore().discoveredCardIds).toEqual(["card-a"]);
  });

  it("clamps numeric preferences to the save-schema ranges on write", () => {
    const settings = useSettingsStore.getState();
    settings.setBrightness(1000);
    settings.setMasterVolume(-20);
    settings.setBackgroundGlowIntensity(1000);

    expect(useSettingsStore.getState().brightness).toBe(150);
    expect(useSettingsStore.getState().masterVolume).toBe(0);
    expect(useSettingsStore.getState().backgroundGlowIntensity).toBe(100);
  });

  it("clears stored autoplay when remember is turned off", () => {
    const settings = useSettingsStore.getState();
    settings.setRememberAutoplayPreference(true);
    settings.setAutoplayEnabled(true);
    expect(useSettingsStore.getState().autoplayEnabled).toBe(true);

    settings.setRememberAutoplayPreference(false);
    expect(useSettingsStore.getState().rememberAutoplayPreference).toBe(false);
    expect(useSettingsStore.getState().autoplayEnabled).toBe(false);
  });

  it("hydrates autoplay off when remember is off even if the save stored it on", () => {
    settingsPersistenceCodec.hydrate(
      makeSave({
        rememberAutoplayPreference: false,
        autoplayEnabled: true,
      }),
    );

    expect(useSettingsStore.getState().rememberAutoplayPreference).toBe(false);
    expect(useSettingsStore.getState().autoplayEnabled).toBe(false);
  });

  it("hydrates autoplay on only when remember is on", () => {
    settingsPersistenceCodec.hydrate(
      makeSave({
        rememberAutoplayPreference: true,
        autoplayEnabled: true,
      }),
    );

    expect(useSettingsStore.getState().rememberAutoplayPreference).toBe(true);
    expect(useSettingsStore.getState().autoplayEnabled).toBe(true);
  });

  it("exposes actions and slices through hooks", () => {
    const { result: actions } = renderHook(() => useSettingsActions());
    actions.current.setBrightness(120);
    expect(useSettingsStore.getState().brightness).toBe(120);

    const { result: settings } = renderHook(() => useAppSettings());
    expect(settings.current.brightness).toBe(120);
    expect(settings.current).not.toHaveProperty("showClearSaveConfirm");

    const { result: aspect } = renderHook(() => useSelectedAspectRatio());
    expect(aspect.current).toBe(defaultSaveData.selectedAspectRatio);
  });
});
