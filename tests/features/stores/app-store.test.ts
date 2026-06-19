import { describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import type { SaveData } from "@/features/alchemy/shared/storage/types";

vi.mock("@/features/alchemy/shared/storage", () => ({
  clearAlchemySaveData: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/storage/defaults", () => ({
  defaultSaveData: {
    selectedAspectRatio: "auto",
    displayMode: "borderless-fullscreen",
    uiScale: "100",
    brightness: 100,
    masterVolume: 50,
    musicVolume: 50,
    sfxVolume: 50,
    muteInBackground: true,
    autoEndTurn: true,
    discoveredCardIds: [],
    encounteredEnemyIds: [],
    discoveredTrinketIds: [],
    completedDifficulties: {
      knight: [],
      rogue: [],
      wizard: [],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
    },
  },
}));

const makeSave = (overrides: Partial<SaveData> = {}): SaveData => ({
  saveSchemaVersion: 2,
  gameBuildVersion: "test",
  contentVersion: 1,
  selectedAspectRatio: "auto",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  brightness: 100,
  musicVolume: 50,
  sfxVolume: 50,
  masterVolume: 50,
  muteInBackground: true,
  autoEndTurn: true,
  discoveredCardIds: ["card-1"],
  encounteredEnemyIds: ["enemy-1"],
  discoveredTrinketIds: ["boon-1"],
  talentXP: {},
  unlockedTalents: {},
  activeRun: null,
  materialInventory: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
  constructedBuildings: {} as Record<string, number>,
  plantedFarms: {} as Record<string, number>,
  completedResearch: {} as Record<string, number>,
  bondedCompanions: {} as Record<string, number>,
  completedDifficulties: {
    knight: [],
    rogue: [],
    wizard: [],
    ranger: [],
    alchemist: [],
    warlock: [],
    druid: [],
    wildcard: [],
  },
  ...overrides,
});

describe("initial state", () => {
  it("has default aspect ratio", () => {
    useAppStore.setState(useAppStore.getInitialState());
    expect(useAppStore.getState().selectedAspectRatio).toBe("auto");
  });

  it("has default display mode", () => {
    useAppStore.setState(useAppStore.getInitialState());
    expect(useAppStore.getState().displayMode).toBe("borderless-fullscreen");
  });

  it("starts with empty discoveredCardIds", () => {
    useAppStore.setState(useAppStore.getInitialState());
    expect(useAppStore.getState().discoveredCardIds).toEqual([]);
  });

  it("starts with empty encounteredEnemyIds", () => {
    useAppStore.setState(useAppStore.getInitialState());
    expect(useAppStore.getState().encounteredEnemyIds).toEqual([]);
  });

  it("starts with empty discoveredTrinketIds", () => {
    useAppStore.setState(useAppStore.getInitialState());
    expect(useAppStore.getState().discoveredTrinketIds).toEqual([]);
  });

  it("starts with all eight characters in completedDifficulties", () => {
    useAppStore.setState(useAppStore.getInitialState());
    const cd = useAppStore.getState().completedDifficulties;
    expect(cd.knight).toEqual([]);
    expect(cd.rogue).toEqual([]);
    expect(cd.wizard).toEqual([]);
    expect(cd.ranger).toEqual([]);
    expect(cd.alchemist).toEqual([]);
    expect(cd.warlock).toEqual([]);
    expect(cd.druid).toEqual([]);
    expect(cd.wildcard).toEqual([]);
  });

  it("starts with collection tab set to cards", () => {
    useAppStore.setState(useAppStore.getInitialState());
    expect(useAppStore.getState().collectionTab).toBe("cards");
  });

  it("starts with showClearSaveConfirm false", () => {
    useAppStore.setState(useAppStore.getInitialState());
    expect(useAppStore.getState().showClearSaveConfirm).toBe(false);
  });
});

describe("initialize", () => {
  it("sets discoveredCardIds from save data", () => {
    useAppStore.getState().initialize(makeSave({ discoveredCardIds: ["card-a", "card-b"] }));
    expect(useAppStore.getState().discoveredCardIds).toEqual(["card-a", "card-b"]);
  });

  it("sets encounteredEnemyIds from save data", () => {
    useAppStore.getState().initialize(makeSave({ encounteredEnemyIds: ["goblin"] }));
    expect(useAppStore.getState().encounteredEnemyIds).toEqual(["goblin"]);
  });

  it("sets completedDifficulties from save data", () => {
    useAppStore.getState().initialize(
      makeSave({
        completedDifficulties: {
          knight: ["difficulty-1"],
          rogue: [],
          wizard: [],
          ranger: [],
          alchemist: [],
          warlock: [],
          druid: [],
          wildcard: [],
        },
      }),
    );
    expect(useAppStore.getState().completedDifficulties.knight).toEqual(["difficulty-1"]);
  });

  it("sets audio volume fields", () => {
    useAppStore.getState().initialize(makeSave({ musicVolume: 50, sfxVolume: 80, masterVolume: 90 }));
    expect(useAppStore.getState().musicVol).toBe(50);
    expect(useAppStore.getState().sfxVol).toBe(80);
    expect(useAppStore.getState().masterVol).toBe(90);
  });
});

describe("setters", () => {
  it("setSelectedAspectRatio updates the field", () => {
    useAppStore.getState().setSelectedAspectRatio("16:9");
    expect(useAppStore.getState().selectedAspectRatio).toBe("16:9");
  });

  it("setDisplayMode updates the field", () => {
    useAppStore.getState().setDisplayMode("windowed");
    expect(useAppStore.getState().displayMode).toBe("windowed");
  });

  it("setUiScale updates the field", () => {
    useAppStore.getState().setUiScale("120");
    expect(useAppStore.getState().uiScale).toBe("120");
  });

  it("setAutoEndTurn updates the field", () => {
    useAppStore.getState().setAutoEndTurn(false);
    expect(useAppStore.getState().autoEndTurn).toBe(false);
  });

  it("setMasterVol updates the field", () => {
    useAppStore.getState().setMasterVol(75);
    expect(useAppStore.getState().masterVol).toBe(75);
  });

  it("setDiscoveredCardIds replaces the list", () => {
    useAppStore.getState().setDiscoveredCardIds(["new-card"]);
    expect(useAppStore.getState().discoveredCardIds).toEqual(["new-card"]);
  });

  it("setEncounteredEnemyIds replaces the list", () => {
    useAppStore.getState().setEncounteredEnemyIds(["dragon"]);
    expect(useAppStore.getState().encounteredEnemyIds).toEqual(["dragon"]);
  });

  it("setCollectionPage clamps to 0", () => {
    useAppStore.getState().setCollectionPage("cards", -1);
    expect(useAppStore.getState().collectionPages.cards).toBe(0);
  });

  it("setCollectionPage sets positive page", () => {
    useAppStore.getState().setCollectionPage("bestiary", 2);
    expect(useAppStore.getState().collectionPages.bestiary).toBe(2);
  });
});

describe("handleCollectionTabChange", () => {
  it("switches to the given tab", () => {
    useAppStore.getState().handleCollectionTabChange("bestiary");
    expect(useAppStore.getState().collectionTab).toBe("bestiary");
  });

  it("initializes page for the new tab", () => {
    useAppStore.getState().handleCollectionTabChange("trinkets");
    expect(useAppStore.getState().collectionPages.trinkets).toBe(0);
  });
});
