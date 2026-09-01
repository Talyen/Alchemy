import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodePersistenceFields,
  hydrateAlchemyPersistenceFields,
  subscribeAlchemyPersistence,
} from "@/features/alchemy/shared/storage/persistence";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { mutateGearForTest, resetRunDomainStore } from "../../../../helpers/gameplay-store-test";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import {
  handleCollectionTabChange,
  setDiscoveredCardIds,
  setMaterials as setRunProfileMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { addGearCurrencies } from "@/features/alchemy/shared/stores/gear-actions";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { createEmptyGearInventories, generateUniqueGearInstance, getUniqueItemDefinition } from "@/lib/gear";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  resetRunDomainStore();
});

describe("persistence coordinator", () => {
  it("round-trips domain-owned save fields without transient UI state", () => {
    hydrateAlchemyPersistenceFields({
      ...defaultSaveData,
      musicVolume: 37,
      discoveredCardIds: ["slash"],
      talentXP: { burn: 25 },
      materialInventory: { wood: 4, iron: 3, herbs: 2, food: 1, gems: 0 },
    });

    useSettingsStore.getState().setShowClearSaveConfirm(true);
    dispatchRunSessionCommand((draft) => handleCollectionTabChange(draft, "bestiary"));

    const encoded = encodePersistenceFields();

    expect(encoded.musicVolume).toBe(37);
    expect(encoded.discoveredCardIds).toEqual(["slash"]);
    expect(encoded.talentXP).toEqual({ burn: 25 });
    expect(encoded.materialInventory).toEqual({ wood: 4, iron: 3, herbs: 2, food: 1, gems: 0 });
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

    expect(readRunProfile().effects.flatPhysicalDamage).toBeGreaterThan(0);
  });

  it("subscribes to every persistence owner through one cleanup", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener);

    useSettingsStore.getState().setMusicVolume(42);
    dispatchRunSessionCommand((draft) => setDiscoveredCardIds(draft, ["slash"]));
    mutateGearForTest((gear) => gear.addCurrencies({ voidstone: 1 }));
    dispatchRunSessionCommand((draft) =>
      setRunProfileMaterials(draft, { wood: 1, iron: 0, herbs: 0, food: 0, gems: 0 }),
    );

    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    useSettingsStore.getState().setMusicVolume(43);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("emits one active-run persistence signal for a multi-store transaction", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener);

    dispatchRunSessionCommand((draft) => {
      setGold(draft, 42);
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
      setGold(draft, 42);
      setHasActiveRun(draft, true);
      setDiscoveredCardIds(draft, ["slash"]);
      addGearCurrencies(draft.gear, { voidstone: 1 });
      setRunProfileMaterials(draft, { wood: 1, iron: 0, herbs: 0, food: 0, gems: 0 });
    });

    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("unions currently owned uniques into collection discovery on hydrate", () => {
    const uniqueDef = getUniqueItemDefinition("wardbreaker");
    if (!uniqueDef) throw new Error("missing wardbreaker unique");
    const unique = generateUniqueGearInstance(uniqueDef);
    const inventories = createEmptyGearInventories();
    inventories.knight = [unique];

    hydrateAlchemyPersistenceFields({
      ...defaultSaveData,
      discoveredUniqueIds: [],
      gearInventories: inventories,
    });

    expect(readProfileStore().discoveredUniqueIds).toEqual(["wardbreaker"]);
  });
});
