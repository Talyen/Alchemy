// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryGearDrag } from "@/features/alchemy/meta/screens/armory/use-armory-gear-drag";
import type { GearInstance, GearLoadout } from "@/lib/gear";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

describe("useArmoryGearDrag double click equipping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("chooses main-hand instead of off-hand when double-clicking a weapon while a bow is equipped", () => {
    const onEquip = vi.fn();
    const bowInstance: GearInstance = {
      instanceId: "bow-1",
      definitionId: "longbow-basic",
      affixes: [],
    };
    const daggerInstance: GearInstance = {
      instanceId: "dagger-1",
      definitionId: "dagger-basic",
      affixes: [],
    };

    const loadout: GearLoadout = {
      "main-hand": "bow-1",
      "off-hand": null,
      body: null,
      helm: null,
      boots: null,
      gloves: null,
      belt: null,
      "left-ring": null,
      "right-ring": null,
      amulet: null,
    };

    const inventoryById = new Map<string, GearInstance>([
      ["bow-1", bowInstance],
      ["dagger-1", daggerInstance],
    ]);

    // Stub querySelector so that it finds mock slot element for main-hand
    const mockSlotElement = document.createElement("div");
    mockSlotElement.setAttribute("data-testid", "armory-equipment-slot");
    mockSlotElement.setAttribute("data-slot", "main-hand");
    vi.spyOn(mockSlotElement, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 50,
      height: 50,
      right: 150,
      bottom: 150,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, "querySelector").mockImplementation((selector) => {
      if (selector === "[data-testid='armory-equipment-slot'][data-slot='main-hand']") {
        return mockSlotElement;
      }
      return null;
    });

    const { result } = renderHook(() =>
      useArmoryGearDrag({
        characterId: "knight",
        editable: true,
        loadout,
        inventoryById,
        packedInventory: { items: [], occupiedRows: 0 },
        inventoryBoardRef: { current: null },
        boardObstacles: [],
        onEquip,
        onUnequip: vi.fn(),
        onMoveItem: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleGearDoubleClick(
        daggerInstance,
        { kind: "inventory", placement: { col: 1, row: 1 } },
        { left: 0, top: 0, width: 0, height: 0 },
      );
    });

    // Advance timer to trigger the flyover commit
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // It should choose main-hand and call onEquip with 'main-hand'
    expect(onEquip).toHaveBeenCalledWith(
      "knight",
      "main-hand",
      daggerInstance,
      expect.objectContaining({ vacatedPlacement: { col: 1, row: 1 } }),
    );
  });

  it("chooses main-hand instead of off-hand when double-clicking a bow while a two-handed weapon is equipped", () => {
    const onEquip = vi.fn();
    const maulInstance: GearInstance = {
      instanceId: "maul-1",
      definitionId: "maul-basic",
      affixes: [],
    };
    const bowInstance: GearInstance = {
      instanceId: "bow-1",
      definitionId: "longbow-basic",
      affixes: [],
    };

    const loadout: GearLoadout = {
      "main-hand": "maul-1",
      "off-hand": null,
      body: null,
      helm: null,
      boots: null,
      gloves: null,
      belt: null,
      "left-ring": null,
      "right-ring": null,
      amulet: null,
    };

    const inventoryById = new Map<string, GearInstance>([
      ["maul-1", maulInstance],
      ["bow-1", bowInstance],
    ]);

    const mockSlotElement = document.createElement("div");
    mockSlotElement.setAttribute("data-testid", "armory-equipment-slot");
    mockSlotElement.setAttribute("data-slot", "main-hand");
    vi.spyOn(mockSlotElement, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 50,
      height: 50,
      right: 150,
      bottom: 150,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, "querySelector").mockImplementation((selector) => {
      if (selector === "[data-testid='armory-equipment-slot'][data-slot='main-hand']") {
        return mockSlotElement;
      }
      return null;
    });

    const { result } = renderHook(() =>
      useArmoryGearDrag({
        characterId: "knight",
        editable: true,
        loadout,
        inventoryById,
        packedInventory: { items: [], occupiedRows: 0 },
        inventoryBoardRef: { current: null },
        boardObstacles: [],
        onEquip,
        onUnequip: vi.fn(),
        onMoveItem: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleGearDoubleClick(
        bowInstance,
        { kind: "inventory", placement: { col: 1, row: 1 } },
        { left: 0, top: 0, width: 0, height: 0 },
      );
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onEquip).toHaveBeenCalledWith(
      "knight",
      "main-hand",
      bowInstance,
      expect.objectContaining({ vacatedPlacement: { col: 1, row: 1 } }),
    );
  });
});

describe("useArmoryGearDrag multi-item unequip animations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("launches two secondary visuals when equipping a two-handed weapon while both hand slots are filled", () => {
    const onEquip = vi.fn();
    const daggerInstance: GearInstance = {
      instanceId: "dagger-1",
      definitionId: "dagger-basic",
      affixes: [],
    };
    const shieldInstance: GearInstance = {
      instanceId: "shield-1",
      definitionId: "kite-shield-basic",
      affixes: [],
    };
    const newMaulInstance: GearInstance = {
      instanceId: "maul-2",
      definitionId: "maul-basic",
      affixes: [],
    };

    const loadout = {
      "main-hand": "dagger-1",
      "off-hand": "shield-1",
      body: null,
      helm: null,
      boots: null,
      gloves: null,
      belt: null,
      "left-ring": null,
      "right-ring": null,
      amulet: null,
    };

    const inventoryById = new Map<string, GearInstance>([
      ["dagger-1", daggerInstance],
      ["shield-1", shieldInstance],
      ["maul-2", newMaulInstance],
    ]);

    const board = document.createElement("div");
    const metricCell = document.createElement("div");
    metricCell.setAttribute("data-armory-grid-metric", "cell");
    const metricStride = document.createElement("div");
    metricStride.setAttribute("data-armory-grid-metric", "stride");
    board.appendChild(metricCell);
    board.appendChild(metricStride);

    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(metricCell, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 48, height: 48, right: 48, bottom: 48, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(metricStride, "getBoundingClientRect").mockReturnValue({
      left: 52, top: 0, width: 48, height: 48, right: 100, bottom: 48, x: 52, y: 0, toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      paddingLeft: "0px", paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px",
      borderLeftWidth: "0px", borderTopWidth: "0px", borderRightWidth: "0px", borderBottomWidth: "0px",
    } as any);

    const mockMainSlotEl = document.createElement("div");
    mockMainSlotEl.setAttribute("data-testid", "armory-equipment-slot");
    mockMainSlotEl.setAttribute("data-slot", "main-hand");
    vi.spyOn(mockMainSlotEl, "getBoundingClientRect").mockReturnValue({
      left: 100, top: 100, width: 50, height: 50, right: 150, bottom: 150, x: 100, y: 100, toJSON: () => ({}),
    } as DOMRect);

    const mockOffSlotEl = document.createElement("div");
    mockOffSlotEl.setAttribute("data-testid", "armory-equipment-slot");
    mockOffSlotEl.setAttribute("data-slot", "off-hand");
    vi.spyOn(mockOffSlotEl, "getBoundingClientRect").mockReturnValue({
      left: 160, top: 100, width: 50, height: 50, right: 210, bottom: 150, x: 160, y: 100, toJSON: () => ({}),
    } as DOMRect);

    vi.spyOn(document, "querySelector").mockImplementation((selector) => {
      if (selector === "[data-testid='armory-equipment-slot'][data-slot='main-hand']") return mockMainSlotEl;
      if (selector === "[data-testid='armory-equipment-slot'][data-slot='off-hand']") return mockOffSlotEl;
      return null;
    });

    const inventoryBoardRef = { current: board };

    const { result } = renderHook(() =>
      useArmoryGearDrag({
        characterId: "knight",
        editable: true,
        loadout,
        inventoryById,
        packedInventory: { items: [], occupiedRows: 0 },
        inventoryBoardRef,
        boardObstacles: [],
        onEquip,
        onUnequip: vi.fn(),
        onMoveItem: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleGearDoubleClick(
        newMaulInstance,
        { kind: "inventory", placement: { col: 1, row: 1 } },
        { left: 0, top: 0, width: 0, height: 0 },
      );
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onEquip).toHaveBeenCalledWith(
      "knight",
      "main-hand",
      newMaulInstance,
      expect.objectContaining({ vacatedPlacement: { col: 1, row: 1 } }),
    );

    expect(result.current.secondaryDragVisuals.length).toBeGreaterThanOrEqual(1);
  });
});
