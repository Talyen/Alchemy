import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeAlchemyPersistenceFields,
  hydrateAlchemyPersistenceFields,
  subscribeAlchemyPersistence,
} from "@/features/alchemy/shared/storage/persistence-coordinator";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { getRunDomainStore, useRunDomainStore } from "@/features/alchemy/shared/stores/run-domain-store";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useProfileStore.setState(useProfileStore.getInitialState(), true);
  useGearStore.setState(useGearStore.getInitialState(), true);
  useRunDomainStore.setState(useRunDomainStore.getInitialState(), true);
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

    expect(getRunDomainStore().profile.effects.flatPhysicalDamage).toBeGreaterThan(0);
  });

  it("subscribes to every persistence owner through one cleanup", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener);

    useSettingsStore.getState().setMusicVol(42);
    useProfileStore.getState().setDiscoveredCardIds(["slash"]);
    useGearStore.getState().addCurrencies({ voidstone: 1 });
    getRunDomainStore().setMaterials({ wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 });

    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    useSettingsStore.getState().setMusicVol(43);
    expect(listener).toHaveBeenCalledTimes(4);
  });
});
