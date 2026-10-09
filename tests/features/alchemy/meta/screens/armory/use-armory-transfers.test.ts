import "../../../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyGearLoadouts, createEmptyEquippedTrinkets, type GearInstance } from "@/lib/gear";
import { useArmoryTransfers } from "@/features/alchemy/meta/screens/armory/use-armory-transfers";
import { useArmoryOrdering } from "@/features/alchemy/meta/screens/armory/use-armory-ordering";

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", () => ({ useReducedMotion: () => motion.reduced }));

const incoming: GearInstance = { instanceId: "incoming", definitionId: "greatsword-basic", affixes: [] };
const replaced: GearInstance = { instanceId: "replaced", definitionId: "longsword-basic", affixes: [] };
const offhand: GearInstance = { instanceId: "offhand", definitionId: "hatchet-basic", affixes: [] };
const inventory = [incoming, replaced, offhand];

function setup({
  success = true,
  geometry = true,
  occupied = true,
  afterProgressSaved = (run: () => void) => run(),
} = {}) {
  if (geometry) {
    document.body.innerHTML = `
      <div data-testid="armory-inventory-item" data-instance-id="incoming"></div>
      <div data-testid="armory-equipment-slot" data-slot="main-hand"></div>
      <div data-testid="armory-equipment-slot" data-slot="off-hand"></div>
      <div data-testid="armory-right-panel"></div>`;
  }
  const loadouts = createEmptyGearLoadouts();
  if (occupied) {
    loadouts.knight["main-hand"] = replaced.instanceId;
    loadouts.knight["off-hand"] = offhand.instanceId;
  }
  const onEquip = vi.fn(() => success);
  return {
    onEquip,
    ...renderHook(() => {
      const ordering = useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "main-hand",
        pickerItems: inventory,
        ownedTrinkets: [],
      });
      const transfers = useArmoryTransfers({
        loadouts,
        equippedTrinkets: createEmptyEquippedTrinkets(),
        onEquip,
        onUnequip: vi.fn(),
        onEquipTrinket: vi.fn(),
        onUnequipTrinket: vi.fn(),
        characterId: "knight",
        selectedSlot: "main-hand",
        inventoryById: new Map(inventory.map((item) => [item.instanceId, item])),
        sharedInventory: inventory,
        ordering,
        requireEditable: (action) => action(),
        setNotice: vi.fn(),
        afterProgressSaved,
      });
      return { ordering, transfers };
    }),
  };
}

describe("Armory transfer orchestration", () => {
  beforeEach(() => {
    motion.reduced = false;
    document.body.innerHTML = "";
  });

  it("waits for saving before moving artwork and discards a transfer after the view changes", () => {
    const pending: Array<() => void> = [];
    const { result, onEquip } = setup({ afterProgressSaved: (run) => pending.push(run) });
    act(() => result.current.transfers.handleEquipGear(incoming));
    expect(onEquip).toHaveBeenCalledOnce();
    expect(result.current.transfers.flyingItems).toEqual([]);
    act(() => pending.shift()!());
    expect(result.current.transfers.flyingItems).toHaveLength(3);
    act(() => result.current.transfers.handleEquipGear(incoming));
    act(() => result.current.transfers.settleActiveTransfers());
    act(() => pending.shift()!());
    expect(result.current.transfers.flyingItems).toEqual([]);
    expect(onEquip).toHaveBeenCalledTimes(2);
  });

  it.each(["animated", "reduced motion", "missing geometry"])(
    "keeps hand-conflict placement independent of %s",
    (mode) => {
      motion.reduced = mode === "reduced motion";
      const { result, onEquip } = setup({ geometry: mode !== "missing geometry" });
      act(() => result.current.transfers.handleEquipGear(incoming));
      expect(onEquip).toHaveBeenCalledOnce();
      const ids = result.current.ordering.visibleGear.map((item) => item.instanceId);
      expect(ids.indexOf(offhand.instanceId)).toBe(ids.indexOf(replaced.instanceId) + 1);
      expect(result.current.ordering.placeholderLocalIndex).toBeNull();
      expect(result.current.transfers.flyingItems.length).toBe(mode === "animated" ? 3 : 0);
    },
  );

  it.each(["reduced motion", "missing geometry"])("clears the empty-slot placeholder without a flight: %s", (mode) => {
    motion.reduced = mode === "reduced motion";
    const { result } = setup({ occupied: false, geometry: mode !== "missing geometry" });
    act(() => result.current.transfers.handleEquipGear(incoming));
    expect(result.current.transfers.flyingItems).toEqual([]);
    expect(result.current.ordering.placeholderLocalIndex).toBeNull();
  });

  it("leaves inventory order and artwork alone when the command is rejected", () => {
    const { result } = setup({ success: false });
    const before = result.current.ordering.visibleGear;
    act(() => result.current.transfers.handleEquipGear(incoming));
    expect(result.current.ordering.visibleGear).toEqual(before);
    expect(result.current.transfers.flyingItems).toEqual([]);
    expect(result.current.transfers.hiddenArtworkIds.size).toBe(0);
  });

  it.each(["scroll", "resize"])("settles all artwork together on %s", (event) => {
    const { result } = setup();
    act(() => result.current.transfers.handleEquipGear(incoming));
    expect(result.current.transfers.hiddenArtworkSlots["main-hand"]).toBe(true);
    expect(result.current.transfers.hiddenArtworkIds.has(replaced.instanceId)).toBe(true);
    act(() => window.dispatchEvent(new Event(event)));
    expect(result.current.transfers.flyingItems).toEqual([]);
    expect(result.current.transfers.hiddenArtworkIds.size).toBe(0);
    expect(result.current.transfers.hiddenArtworkSlots).toEqual({});
  });
});
