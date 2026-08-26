import { beforeEach, describe, expect, it } from "vitest";
import { profilePersistenceCodec } from "@/features/alchemy/shared/stores/profile-store";
import { useProfileStore } from "../../../../helpers/gameplay-store-test";
import { settingsPersistenceCodec, useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { defaultSaveData, type SaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

function makeSave(overrides: Partial<SaveData> = {}): SaveData {
  return { ...defaultSaveData, ...overrides };
}

beforeEach(() => {
  useProfileStore.setState(useProfileStore.getInitialState());
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe("profile store", () => {
  it("owns persistent discoveries, completion, and collection view state", () => {
    const profile = useProfileStore.getState();
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

    const profile = useProfileStore.getState();
    expect(profile.discoveredCardIds).toEqual(["card-a"]);
    expect(profile.encounteredEnemyIds).toEqual(["goblin"]);
    expect(profile.completedDifficulties.knight).toEqual(["difficulty-1"]);
  });

  it("supports functional discovery updates and collection navigation", () => {
    const profile = useProfileStore.getState();
    profile.setDiscoveredCardIds((previous) => [...previous, "card-a"]);
    profile.setCollectionPage("bestiary", 2);
    profile.setCollectionPage("cards", -1);
    profile.handleCollectionTabChange("bestiary");

    expect(useProfileStore.getState()).toMatchObject({
      discoveredCardIds: ["card-a"],
      collectionTab: "bestiary",
      collectionPages: { heroes: 0, cards: 0, bestiary: 2, trinkets: 0, uniques: 0 },
    });
  });

  it("resets persisted and transient profile state", () => {
    const profile = useProfileStore.getState();
    profile.setDiscoveredCardIds(["card-a"]);
    profile.handleCollectionTabChange("trinkets");
    profile.resetToDefaults();

    expect(useProfileStore.getState().discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(useProfileStore.getState().collectionTab).toBe("heroes");
  });

  it("setState from getInitialState only writes data fields onto the aggregate", () => {
    useProfileStore.setState(useProfileStore.getInitialState());
    const encoded = profilePersistenceCodec.encode();
    expect(encoded).toEqual({
      discoveredCardIds: [],
      encounteredEnemyIds: [],
      discoveredTrinketIds: [],
      discoveredUniqueIds: [],
      completedDifficulties: expect.any(Object),
      finishedRunCharacters: [],
    });
    expect(typeof useProfileStore.getState().setDiscoveredCardIds).toBe("function");
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
    useProfileStore.getState().setDiscoveredCardIds(["card-a"]);
    const settings = useSettingsStore.getState();
    settings.setBrightness(120);
    settings.setMasterVolume(75);
    settings.setShowClearSaveConfirm(true);
    settings.resetToDefaults();

    expect(useSettingsStore.getState().brightness).toBe(defaultSaveData.brightness);
    expect(useSettingsStore.getState().masterVolume).toBe(defaultSaveData.masterVolume);
    expect(useSettingsStore.getState().showClearSaveConfirm).toBe(false);
    expect(useProfileStore.getState().discoveredCardIds).toEqual(["card-a"]);
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
});
