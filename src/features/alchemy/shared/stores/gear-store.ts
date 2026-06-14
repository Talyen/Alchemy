import { create } from "zustand";
import type { CharacterId } from "@/lib/game-data";
import {
  createEmptyGearLoadouts,
  equipGear,
  salvageGear,
  unequipGear,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
} from "@/lib/gear";

type GearStore = {
  inventory: GearInstance[];
  loadouts: GearLoadouts;
  initialize: (inventory: GearInstance[], loadouts: GearLoadouts) => void;
  addInstance: (instance: GearInstance) => void;
  equip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  unequip: (characterId: CharacterId, slot: GearSlot) => void;
  salvage: (instanceId: string) => ReturnType<typeof salvageGear>;
  reset: () => void;
};

const initialState = { inventory: [] as GearInstance[], loadouts: createEmptyGearLoadouts() };

export const useGearStore = create<GearStore>((set, get) => ({
  ...initialState,
  initialize: (inventory, loadouts) => set({ inventory, loadouts }),
  addInstance: (instance) => set((state) => ({ inventory: [...state.inventory, instance] })),
  equip: (characterId, slot, instance) =>
    set((state) => ({ loadouts: equipGear(state.loadouts, characterId, slot, instance) })),
  unequip: (characterId, slot) => set((state) => ({ loadouts: unequipGear(state.loadouts, characterId, slot) })),
  salvage: (instanceId) => {
    const result = salvageGear(get().inventory, get().loadouts, instanceId);
    if (result) set({ inventory: result.inventory });
    return result;
  },
  reset: () => set({ inventory: [], loadouts: createEmptyGearLoadouts() }),
}));
