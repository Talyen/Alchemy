import { isDeepStrictEqual } from "node:util";
import "../helpers/mock-audio";
import { act, cleanup, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import {
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  flattenGearInventories,
  type GearInstance,
} from "@/lib/gear";
import { useArmoryTransfers } from "@/features/alchemy/meta/screens/armory/use-armory-transfers";
import { useArmoryOrdering } from "@/features/alchemy/meta/screens/armory/use-armory-ordering";
import { useGearArmorySlice, readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { defaultGameSession } from "@/app/application-session";
import { resetAllTestStores } from "../helpers/run-domain-store-test";
import { defineSequenceFamily, requireProgress, type Scenario } from "./sequence";
import { advance, installFrames, installMotionPreference } from "./timing";

const inventory: GearInstance[] = [
  { instanceId: "incoming", definitionId: "greatsword-basic", affixes: [] },
  { instanceId: "replaced", definitionId: "longsword-basic", affixes: [] },
  { instanceId: "offhand", definitionId: "hatchet-basic", affixes: [] },
];
defineSequenceFamily("armory", (seed) => {
  resetAllTestStores();
  installFrames();
  installMotionPreference(seed % 3 === 0);
  const inventories = createEmptyGearInventories();
  inventories.knight = inventory;
  dispatchGearMutationWithRunHealthSync(
    { mutate: (gear) => gear.initialize(inventories, createEmptyGearLoadouts()) },
    defaultGameSession,
  );
  document.body.innerHTML = `<div data-testid="armory-inventory-item" data-instance-id="incoming"></div><div data-testid="armory-equipment-slot" data-slot="main-hand"></div><div data-testid="armory-right-panel"></div>`;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
    toJSON: () => ({}),
  });
  const mounted = renderHook(() => {
    const gear = useGearArmorySlice();
    const shared = flattenGearInventories(gear.inventories);
    const picker = shared.filter((item) => !Object.values(gear.loadouts.knight).includes(item.instanceId));
    const ordering = useArmoryOrdering({
      characterId: "knight",
      selectedSlot: "main-hand",
      pickerItems: picker,
      ownedTrinkets: [],
    });
    const transfers = useArmoryTransfers({
      loadouts: gear.loadouts,
      equippedTrinkets: gear.equippedTrinkets,
      onEquip: (character, slot, item) =>
        dispatchGearMutationWithRunHealthSync(
          { mutate: (draft) => draft.equip(character, slot, item) },
          defaultGameSession,
        ),
      onUnequip: (character, slot) => {
        dispatchGearMutationWithRunHealthSync(
          { mutate: (draft) => draft.unequip(character, slot) },
          defaultGameSession,
        );
      },
      onEquipTrinket: (character, id) => {
        dispatchGearMutationWithRunHealthSync(
          { mutate: (draft) => draft.equipTrinket(character, id) },
          defaultGameSession,
        );
      },
      onUnequipTrinket: (character) => {
        dispatchGearMutationWithRunHealthSync(
          { mutate: (draft) => draft.unequipTrinket(character) },
          defaultGameSession,
        );
      },
      characterId: "knight",
      selectedSlot: "main-hand",
      sharedInventory: shared,
      inventoryById: new Map(shared.map((item) => [item.instanceId, item])),
      ordering,
      requireEditable: (action) => action(),
      setNotice: () => {},
    });
    return { ordering, transfers };
  });
  let settled = false;
  const observe = () => ({
    loadout: readGearState(defaultGameSession).loadouts.knight,
    visible: mounted.result.current.ordering.visibleGear.map((item) => item.instanceId),
    hidden: [...mounted.result.current.transfers.hiddenArtworkIds],
    placeholder: mounted.result.current.ordering.placeholderLocalIndex,
  });
  return {
    fixture: { inventory, reducedMotion: seed % 3 === 0 },
    actions: () => ["equip", "equip-stale", "unequip", "resize", "scroll", "filter", "clear-filter"],
    async run(action) {
      settled = ["resize", "scroll"].includes(action);
      act(() => {
        const { transfers, ordering } = mounted.result.current;
        if (action === "equip") transfers.handleEquipGear(inventory[0]!);
        if (action === "equip-stale") {
          const before = readGearState(defaultGameSession);
          transfers.handleEquipGear({ ...inventory[0]!, instanceId: "missing" });
          requireProgress(
            isDeepStrictEqual(readGearState(defaultGameSession), before),
            "armory-stale-command-rejected",
            observe(),
          );
        }
        if (action === "unequip") transfers.handleSlotUnequip("main-hand");
        if (action === "resize" || action === "scroll") window.dispatchEvent(new Event(action));
        if (action === "filter" || action === "clear-filter")
          ordering.setFilters({ search: action === "filter" ? "unlikely match" : "", rarities: [], keywords: [] });
      });
      await advance(1);
    },
    check() {
      const state = observe();
      requireProgress(
        flattenGearInventories(readGearState(defaultGameSession).inventories).length === 3,
        "armory-item-conservation",
        state,
      );
      const equipped = state.loadout["main-hand"];
      if (!mounted.result.current.ordering.hasCriteria)
        requireProgress(!equipped || !state.visible.includes(equipped), "armory-equipped-not-in-picker", state);
      if (settled)
        requireProgress(
          state.hidden.length === 0 && state.placeholder === null,
          "armory-interruption-reveals-items",
          state,
        );
    },
    observe,
    async settle(this: Scenario) {
      await this.run("resize");
    },
    dispose() {
      mounted.unmount();
      cleanup();
      document.body.innerHTML = "";
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    },
  };
});
