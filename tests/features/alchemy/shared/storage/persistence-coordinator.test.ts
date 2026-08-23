import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeAlchemyPersistenceFields,
  hydrateAlchemyPersistenceFields,
  subscribeAlchemyPersistence,
} from "@/features/alchemy/shared/storage/persistence-coordinator";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useGearStore, useProfileStore } from "../../../../helpers/gameplay-store-test";
import { getRunProfileStore, useRunProfileStore } from "../../../../helpers/gameplay-store-test";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import {
  setDiscoveredCardIds,
  setMaterials as setRunProfileMaterials,
} from "@/features/alchemy/shared/stores/write-port-profile";
import { addGearCurrencies } from "@/features/alchemy/shared/stores/gear-actions";
import { setRunGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useProfileStore.setState(useProfileStore.getInitialState());
  useGearStore.setState(useGearStore.getInitialState());
  useRunProfileStore.setState(useRunProfileStore.getInitialState(), true);
});

describe("persistence coordinator", () => {
  it("round-trips domain-owned save fields without transient UI state", () => {
    hydrateAlchemyPersistenceFields({
      ...defaultSaveData,
      musicVolume: 37,
      discoveredCardIds: ["slash"],
      talentXP: { burn: 25 },
      materialInventory: { wood: 4, iron: 3, herbs: 2, food: 1, crystal: 0 },
    });

    useSettingsStore.getState().setShowClearSaveConfirm(true);
    useProfileStore.getState().handleCollectionTabChange("bestiary");

    const encoded = encodeAlchemyPersistenceFields();

    expect(encoded.musicVolume).toBe(37);
    expect(encoded.discoveredCardIds).toEqual(["slash"]);
    expect(encoded.talentXP).toEqual({ burn: 25 });
    expect(encoded.materialInventory).toEqual({ wood: 4, iron: 3, herbs: 2, food: 1, crystal: 0 });
    expect(encoded).not.toHaveProperty("showClearSaveConfirm");
    expect(encoded).not.toHaveProperty("collectionTab");
  });

  it("hydrates derived homestead effects from persisted source fields", () => {
    hydrateAlchemyPersistenceFields({
      ...defaultSaveData,
      constructedBuildings: {
        ...defaultSaveData.constructedBuildings,
        "blacksmiths-forge": 1,
      },
    });

    expect(getRunProfileStore().effects.flatPhysicalDamage).toBeGreaterThan(0);
  });

  it("subscribes to every persistence owner through one cleanup", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener);

    useSettingsStore.getState().setMusicVolume(42);
    useProfileStore.getState().setDiscoveredCardIds(["slash"]);
    useGearStore.getState().addCurrencies({ voidstone: 1 });
    getRunProfileStore().setMaterials({ wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 });

    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    useSettingsStore.getState().setMusicVolume(43);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("emits one active-run persistence signal for a multi-store transaction", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener);

    dispatchRunSessionCommand((draft) => {
      setRunGold(draft, 42);
      setHasActiveRun(draft, true);
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(readRunProfile().gold).toBe(42);
    unsubscribe();
  });

  it("coalesces every gameplay persistence owner into one session signal", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener);

    dispatchRunSessionCommand((draft) => {
      setRunGold(draft, 42);
      setHasActiveRun(draft, true);
      setDiscoveredCardIds(draft, ["slash"]);
      addGearCurrencies(draft.gear, { voidstone: 1 });
      setRunProfileMaterials(draft, { wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 });
    });

    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
