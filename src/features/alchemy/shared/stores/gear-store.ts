import { create } from "zustand";
import type { CharacterId } from "@/lib/game-data";
import {
  createEmptyGearLoadouts,
  equipGear,
  sanitizeGearBoardPositions,
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
  equip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: { col: number; row: number }; swapDisplaced?: boolean },
  ) => void;
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

function boardPositionsEqual(left: GearBoardPositions, right: GearBoardPositions): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((instanceId) => {
    const leftPosition = left[instanceId];
    const rightPosition = right[instanceId];
    return (
      leftPosition !== undefined &&
      rightPosition !== undefined &&
      leftPosition.col === rightPosition.col &&
      leftPosition.row === rightPosition.row
    );
  });
}

export const useGearStore = create<GearStore>((set, get) => ({
  ...initialState,
  initialize: (inventory, loadouts, boardPositions = {}) => {
    const legacy = Object.keys(boardPositions).length === 0 ? readLegacyBoardPositions() : {};
    const merged = { ...legacy, ...boardPositions };
    set({
      inventory,
      loadouts,
      boardPositions: sanitizeGearBoardPositions(merged, inventory),
    });
  },
  addInstance: (instance) => set((state) => ({ inventory: [...state.inventory, instance] })),
  equip: (characterId, slot, instance, options) =>
    set((state) => {
      const displacedId = state.loadouts[characterId]?.[slot] ?? null;
      const nextLoadouts = equipGear(state.loadouts, characterId, slot, instance, state.inventory);
      let nextPositions = { ...state.boardPositions };

      if (options?.vacatedPlacement) {
        delete nextPositions[instance.instanceId];
        if (options.swapDisplaced !== false && displacedId && displacedId !== instance.instanceId) {
          nextPositions[displacedId] = options.vacatedPlacement;
        }
      }

      return {
        loadouts: nextLoadouts,
        boardPositions: sanitizeGearBoardPositions(nextPositions, state.inventory),
      };
    }),
  unequip: (characterId, slot) => set((state) => ({ loadouts: unequipGear(state.loadouts, characterId, slot) })),
  setBoardPosition: (instanceId, col, row) =>
    set((state) => ({
      boardPositions: { ...state.boardPositions, [instanceId]: { col, row } },
    })),
  syncBoardPositions: () =>
    set((state) => {
      const nextBoardPositions = sanitizeGearBoardPositions(state.boardPositions, state.inventory);
      if (boardPositionsEqual(state.boardPositions, nextBoardPositions)) return state;
      return { boardPositions: nextBoardPositions };
    }),
  salvage: (instanceId) => {
    const result = salvageGear(get().inventory, get().loadouts, instanceId);
    if (result) {
      const nextPositions = { ...get().boardPositions };
      delete nextPositions[instanceId];
      set({
        inventory: result.inventory,
        boardPositions: sanitizeGearBoardPositions(nextPositions, result.inventory),
      });
    }
    return result;
  },
  reset: () => set(initialState),
}));
