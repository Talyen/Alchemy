import { create } from "zustand";
import type { CharacterId } from "@/lib/game-data";
import {
  createEmptyGearLoadouts,
  equipGear,
  pruneGearBoardPositions,
  salvageGear,
  unequipGear,
  type GearBoardPositions,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
} from "@/lib/gear";

const LEGACY_ARMORY_POSITIONS_KEY = "alchemy-armory-positions";

function readLegacyBoardPositions(): GearBoardPositions {
  if (typeof localStorage === "undefined") return {};
  try {
    const stored = localStorage.getItem(LEGACY_ARMORY_POSITIONS_KEY);
    if (!stored) return {};
    localStorage.removeItem(LEGACY_ARMORY_POSITIONS_KEY);
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as GearBoardPositions;
  } catch {
    return {};
  }
}

type GearStore = {
  inventory: GearInstance[];
  loadouts: GearLoadouts;
  boardPositions: GearBoardPositions;
  initialize: (inventory: GearInstance[], loadouts: GearLoadouts, boardPositions?: GearBoardPositions) => void;
  addInstance: (instance: GearInstance) => void;
  equip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  unequip: (characterId: CharacterId, slot: GearSlot) => void;
  setBoardPosition: (instanceId: string, col: number, row: number) => void;
  syncBoardPositions: () => void;
  salvage: (instanceId: string) => ReturnType<typeof salvageGear>;
  reset: () => void;
};

const initialState = {
  inventory: [] as GearInstance[],
  loadouts: createEmptyGearLoadouts(),
  boardPositions: {} as GearBoardPositions,
};

export const useGearStore = create<GearStore>((set, get) => ({
  ...initialState,
  initialize: (inventory, loadouts, boardPositions = {}) => {
    const legacy = Object.keys(boardPositions).length === 0 ? readLegacyBoardPositions() : {};
    const merged = { ...legacy, ...boardPositions };
    set({
      inventory,
      loadouts,
      boardPositions: pruneGearBoardPositions(merged, inventory),
    });
  },
  addInstance: (instance) => set((state) => ({ inventory: [...state.inventory, instance] })),
  equip: (characterId, slot, instance) =>
    set((state) => ({
      loadouts: equipGear(state.loadouts, characterId, slot, instance, state.inventory),
    })),
  unequip: (characterId, slot) => set((state) => ({ loadouts: unequipGear(state.loadouts, characterId, slot) })),
  setBoardPosition: (instanceId, col, row) =>
    set((state) => ({
      boardPositions: { ...state.boardPositions, [instanceId]: { col, row } },
    })),
  syncBoardPositions: () =>
    set((state) => ({
      boardPositions: pruneGearBoardPositions(state.boardPositions, state.inventory),
    })),
  salvage: (instanceId) => {
    const result = salvageGear(get().inventory, get().loadouts, instanceId);
    if (result) {
      const nextPositions = { ...get().boardPositions };
      delete nextPositions[instanceId];
      set({
        inventory: result.inventory,
        boardPositions: pruneGearBoardPositions(nextPositions, result.inventory),
      });
    }
    return result;
  },
  reset: () => set(initialState),
}));
