// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryGearTile } from "@/features/alchemy/meta/screens/armory/parts/inventory-tile";
import { SlotButton } from "@/features/alchemy/meta/screens/armory/parts/slot-button";
import { DragVisualPortal } from "@/features/alchemy/meta/screens/armory/armory-drag-visual-portal";
import {
  readInventoryBoardMetrics,
  placeInventoryTileFromMetrics,
} from "@/features/alchemy/meta/screens/armory/board-drag-math";
import { SALVAGE_TARGET_SHADOW } from "@/features/alchemy/meta/screens/armory/targeting-highlight";
import { GearTooltipContent } from "@/features/alchemy/meta/screens/armory/gear-tooltip-content";
import { ArmoryTransferMenu } from "@/features/alchemy/meta/screens/armory/armory-transfer-menu";
import { ArmoryOverlays } from "@/features/alchemy/meta/screens/armory/armory-overlays";
import { EMPTY_CRAFTING_CURRENCIES, gearDefinitions } from "@/lib/gear";
import type { GearInstance, GearLoadout } from "@/lib/gear";
import { playUISound } from "@/lib/audio";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

describe("Armory Styling TDD", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has SALVAGE_TARGET_SHADOW defined", () => {
    expect(SALVAGE_TARGET_SHADOW).toBeDefined();
    expect(SALVAGE_TARGET_SHADOW).toContain("shadow-");
    expect(SALVAGE_TARGET_SHADOW).toContain("rgba(248,113,113");
  });

  it("renders highlight overlay in InventoryGearTile when in salvage mode", () => {
    const gear: GearInstance = {
      instanceId: "gear-1",
      definitionId: "dagger-basic",
      affixes: [],
    };

    const { container } = render(
      <InventoryGearTile
        instance={gear}
        placement={{ col: 1, row: 1, w: 1, h: 1 }}
        inventory={[gear]}
        editable={true}
        salvageMode={true}
        activeCurrencyId={null}
        dragging={false}
        secondaryDragging={false}
        interactionSuppressed={false}
        hasActiveDrag={false}
        dragSequence={1}
        shouldSuppressClick={() => false}
        onSalvage={vi.fn()}
        onApplyCurrency={vi.fn()}
        onGearPointerStart={vi.fn()}
        onGearPointerMove={vi.fn()}
        onGearPointerEnd={vi.fn()}
        onGearDoubleClick={vi.fn()}
        onAbortGearDrag={vi.fn()}
      />,
    );

    // The overlay should be present and have the red ring & shadow classes
    const overlay = container.querySelector(".absolute.inset-0.z-20.pointer-events-none");
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("ring-red");
    expect(overlay?.className).toContain("shadow-");
  });

  it("renders highlight overlay in SlotButton when compatible during drag", () => {
    const gear: GearInstance = {
      instanceId: "gear-1",
      definitionId: "dagger-basic",
      affixes: [],
    };
    const loadout: GearLoadout = {
      "main-hand": null,
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

    const { container } = render(
      <SlotButton
        slot="main-hand"
        instance={undefined}
        loadout={loadout}
        inventory={[]}
        editable={true}
        draggedGear={gear}
        isDraggingActive={true}
        salvageMode={false}
        activeCurrencyId={null}
        onGearPointerStart={vi.fn()}
        onGearPointerMove={vi.fn()}
        onGearPointerEnd={vi.fn()}
        onGearDoubleClick={vi.fn()}
        onSalvage={vi.fn()}
        onApplyCurrency={vi.fn()}
        onAbortGearDrag={vi.fn()}
      />,
    );

    const overlay = container.querySelector(".absolute.inset-0.z-20.pointer-events-none");
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("shadow-");
  });

  it("renders the portal image with grid layout classes", () => {
    const visual = {
      instance: { instanceId: "gear-1", definitionId: "dagger-basic", affixes: [] },
      source: { left: 0, top: 0, width: 50, height: 50 },
      rect: { left: 10, top: 10, width: 50, height: 50 },
      origin: { kind: "inventory" as const, placement: { col: 1, row: 1 } },
      destination: null,
      settling: false,
    };

    const { unmount } = render(
      <DragVisualPortal visual={visual} onComplete={vi.fn()}>
        <img src="dagger-art.png" alt="" />
      </DragVisualPortal>,
    );

    const img = document.body.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.className).toContain("-inset-px");
    expect(img?.className).toContain("h-[calc(100%+2px)]");
    unmount();
  });

  it("sizes flyover visuals to the destination rect", async () => {
    const visual = {
      source: { left: 0, top: 0, width: 40, height: 40 },
      rect: { left: 80, top: 20, width: 96, height: 64 },
      origin: { kind: "inventory" as const, placement: { col: 1, row: 1 } },
      destination: null,
      flyover: true,
    };

    const { unmount } = render(
      <DragVisualPortal visual={visual} onComplete={vi.fn()}>
        <div />
      </DragVisualPortal>,
    );

    const portal = screen.getByTestId("armory-gear-drag-visual");
    await waitFor(() => {
      expect(portal.getAttribute("style")).toContain("width: 96px");
      expect(portal.getAttribute("style")).toContain("height: 64px");
    });
    unmount();
  });

  it("plays salvage sound only after successful salvage confirmation", () => {
    const salvageTarget: GearInstance = {
      instanceId: "gear-1",
      definitionId: "dagger-basic",
      affixes: [],
    };
    const onSalvage = vi.fn().mockReturnValue(false);

    const { rerender } = render(
      <ArmoryOverlays
        salvageTarget={salvageTarget}
        currencyDragVisual={null}
        dragVisual={null}
        secondaryDragVisuals={[]}
        activeCurrencyId={null}
        cursorPoint={null}
        transferMenu={null}
        craftingCurrencies={EMPTY_CRAFTING_CURRENCIES}
        finishedRunCharacters={["knight"]}
        editable={true}
        onSalvage={onSalvage}
        onTransferGear={vi.fn().mockReturnValue(false)}
        onClearSalvageTarget={vi.fn()}
        onClearDragState={vi.fn()}
        onCompleteDragAnimation={vi.fn()}
        onClearSecondaryDragState={vi.fn()}
        onCloseTransferMenu={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvage" }));
    expect(playUISound).not.toHaveBeenCalledWith("salvage");
    expect(playUISound).toHaveBeenCalledWith("error");

    vi.mocked(playUISound).mockClear();
    onSalvage.mockReturnValue(true);
    rerender(
      <ArmoryOverlays
        salvageTarget={salvageTarget}
        currencyDragVisual={null}
        dragVisual={null}
        secondaryDragVisuals={[]}
        activeCurrencyId={null}
        cursorPoint={null}
        transferMenu={null}
        craftingCurrencies={EMPTY_CRAFTING_CURRENCIES}
        finishedRunCharacters={["knight"]}
        editable={true}
        onSalvage={onSalvage}
        onTransferGear={vi.fn().mockReturnValue(false)}
        onClearSalvageTarget={vi.fn()}
        onClearDragState={vi.fn()}
        onCompleteDragAnimation={vi.fn()}
        onClearSecondaryDragState={vi.fn()}
        onCloseTransferMenu={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvage" }));
    expect(playUISound).toHaveBeenCalledWith("salvage");
  });

  it("adjusts boardRect for padding/border inside readInventoryBoardMetrics", () => {
    const board = document.createElement("div");
    const cell = document.createElement("div");
    cell.setAttribute("data-armory-grid-metric", "cell");
    const stride = document.createElement("div");
    stride.setAttribute("data-armory-grid-metric", "stride");
    board.appendChild(cell);
    board.appendChild(stride);

    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 200,
      height: 200,
      right: 300,
      bottom: 300,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 40,
      height: 40,
      right: 140,
      bottom: 140,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    vi.spyOn(stride, "getBoundingClientRect").mockReturnValue({
      left: 150,
      top: 100,
      width: 40,
      height: 40,
      right: 190,
      bottom: 140,
      x: 150,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    // Mock window.getComputedStyle to return padding & border
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      paddingLeft: "6px",
      paddingTop: "6px",
      paddingRight: "6px",
      paddingBottom: "6px",
      borderLeftWidth: "2px",
      borderTopWidth: "2px",
      borderRightWidth: "2px",
      borderBottomWidth: "2px",
    } as any);

    const metrics = readInventoryBoardMetrics(board);
    expect(metrics).not.toBeNull();
    // boardRect left adjusted: 100 + 6 + 2 = 108
    expect(metrics?.boardRect.left).toBe(108);
    expect(metrics?.boardRect.top).toBe(108);
  });

  it("renders a shine text effect when an Astral affix rolls its maximum value", () => {
    const maxAstralGear: GearInstance = {
      instanceId: "gear-astral-max",
      definitionId: "dagger-astral",
      affixes: [{ id: "flat-burn", value: 4 }], // max roll for flat-burn (astral range is 3-4)
    };

    const def = gearDefinitions["dagger-astral"];
    const { container } = render(<GearTooltipContent definition={def} instance={maxAstralGear} />);

    // Expect 2 shine elements (1 for item title, 1 for affix subheader)
    const elements = container.querySelectorAll(".boss-title-shine");
    expect(elements.length).toBe(2);

    let hasGradient = false;
    elements.forEach((el) => {
      if (el.getAttribute("style")?.includes("linear-gradient")) {
        hasGradient = true;
      }
    });
    expect(hasGradient).toBe(true);
  });

  it("does not render a shine text effect when an Astral affix rolls below its maximum value", () => {
    const subMaxAstralGear: GearInstance = {
      instanceId: "gear-astral-submax",
      definitionId: "dagger-astral",
      affixes: [{ id: "flat-burn", value: 3 }], // below max roll
    };

    const def = gearDefinitions["dagger-astral"];
    const { container } = render(<GearTooltipContent definition={def} instance={subMaxAstralGear} />);

    // Expect 1 shine element (only the item title itself)
    const elements = container.querySelectorAll(".boss-title-shine");
    expect(elements.length).toBe(1);
  });

  it("placeInventoryTileFromMetrics uses DOM cell getBoundingClientRect when data-armory-inventory-cell is present", () => {
    const board = document.createElement("div");
    const metricCell = document.createElement("div");
    metricCell.setAttribute("data-armory-grid-metric", "cell");
    const metricStride = document.createElement("div");
    metricStride.setAttribute("data-armory-grid-metric", "stride");
    const targetCell = document.createElement("div");
    targetCell.setAttribute("data-armory-inventory-cell", "1-1");
    board.appendChild(metricCell);
    board.appendChild(metricStride);
    board.appendChild(targetCell);

    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 400,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(metricCell, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 48,
      height: 48,
      right: 48,
      bottom: 48,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(metricStride, "getBoundingClientRect").mockReturnValue({
      left: 52,
      top: 0,
      width: 48,
      height: 48,
      right: 100,
      bottom: 48,
      x: 52,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(targetCell, "getBoundingClientRect").mockReturnValue({
      left: 8,
      top: 12,
      width: 48,
      height: 48,
      right: 56,
      bottom: 60,
      x: 8,
      y: 12,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      paddingLeft: "0px",
      paddingTop: "0px",
      paddingRight: "0px",
      paddingBottom: "0px",
      borderLeftWidth: "0px",
      borderTopWidth: "0px",
      borderRightWidth: "0px",
      borderBottomWidth: "0px",
    } as any);

    const footprint = { w: 1, h: 1 };
    const freeRect = { left: 20, top: 24, width: 48, height: 48 };
    const result = placeInventoryTileFromMetrics(board, footprint, freeRect, null, { requireProximity: false });

    expect(result).not.toBeNull();
    expect(result?.rect.left).toBe(8);
    expect(result?.rect.top).toBe(12);
  });

  it("placeInventoryTileFromMetrics falls back to calculated coords when no DOM cell element found", () => {
    const board = document.createElement("div");
    const metricCell = document.createElement("div");
    metricCell.setAttribute("data-armory-grid-metric", "cell");
    const metricStride = document.createElement("div");
    metricStride.setAttribute("data-armory-grid-metric", "stride");
    board.appendChild(metricCell);
    board.appendChild(metricStride);

    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 400,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(metricCell, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 48,
      height: 48,
      right: 48,
      bottom: 48,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(metricStride, "getBoundingClientRect").mockReturnValue({
      left: 52,
      top: 0,
      width: 48,
      height: 48,
      right: 100,
      bottom: 48,
      x: 52,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      paddingLeft: "0px",
      paddingTop: "0px",
      paddingRight: "0px",
      paddingBottom: "0px",
      borderLeftWidth: "0px",
      borderTopWidth: "0px",
      borderRightWidth: "0px",
      borderBottomWidth: "0px",
    } as any);

    const footprint = { w: 1, h: 1 };
    const freeRect = { left: 20, top: 24, width: 48, height: 48 };
    const result = placeInventoryTileFromMetrics(board, footprint, freeRect, null, { requireProximity: false });

    expect(result).not.toBeNull();
    expect(result?.rect.left).toBe(0);
    expect(result?.rect.top).toBe(0);
  });

  it("renders the transfer menu with bg-card and border-border classes", () => {
    const transferMenu = {
      instanceId: "gear-1",
      sourceCharacterId: "knight" as const,
      anchor: { x: 100, y: 100 },
    };

    const { unmount } = render(
      <ArmoryTransferMenu
        transferMenu={transferMenu}
        finishedRunCharacters={["knight", "ranger"]}
        onTransferGear={vi.fn().mockReturnValue(true)}
        onClose={vi.fn()}
      />,
    );

    const menu = document.body.querySelector('[data-testid="armory-transfer-menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.className).toContain("bg-card");
    expect(menu?.className).toContain("border-border");
    unmount();
  });
});
