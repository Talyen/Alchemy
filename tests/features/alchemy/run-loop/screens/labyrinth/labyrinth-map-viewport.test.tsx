import { cleanup, fireEvent, render } from "@testing-library/react";
import { labyrinthShroudedArt, mysteryBg } from "@/features/alchemy/shared/config/game-data-catalog";
import { afterEach, expect, it, vi } from "vitest";
import { floorNodes } from "@/lib/content-systems/labyrinth/map-state";
import { LabyrinthMapViewport } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-viewport";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderViewport(selectedNodeId: string) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ width: "800px", height: "600px" } as CSSStyleDeclaration);
  const map = gridLabyrinthMapFixture();
  const props = {
    map,
    nodes: floorNodes(map, map.currentFloor),
    selectedNodeId,
    onEnter: vi.fn(),
    onDescend: vi.fn(),
    onSelect: vi.fn(),
    onDeselect: vi.fn(),
  };
  const view = render(<LabyrinthMapViewport {...props} />);
  return {
    ...props,
    rerender: () => {
      const nextMap = structuredClone(props.map);
      view.rerender(
        <LabyrinthMapViewport {...props} map={nextMap} nodes={floorNodes(nextMap, nextMap.currentFloor)} />,
      );
    },
  };
}

it("dismisses the detail pane when pressing an undiscovered node", () => {
  const props = renderViewport("labyrinth-floor-1-n0");
  const undiscovered = document.querySelector('[data-labyrinth-node][data-state="undiscovered"]');
  expect(undiscovered).toBeTruthy();
  fireEvent.pointerDown(undiscovered!);
  expect(props.onDeselect).toHaveBeenCalledOnce();
  expect(props.onSelect).not.toHaveBeenCalled();
});

it("keeps the detail pane when pressing another discovered node", () => {
  const props = renderViewport("labyrinth-floor-1-n0");
  const discovered = document.querySelector('[data-labyrinth-node="labyrinth-floor-1-n14"]');
  expect(discovered?.getAttribute("data-state")).not.toBe("undiscovered");
  fireEvent.pointerDown(discovered!);
  expect(props.onDeselect).not.toHaveBeenCalled();
});

it("keeps varied fog independent of hidden encounters and replaces it upon discovery", () => {
  const props = renderViewport("labyrinth-floor-1-n0");
  const hidden = Array.from(document.querySelectorAll<HTMLElement>('[data-labyrinth-node][data-state="undiscovered"]'));
  const sources = hidden.map((tile) => tile.querySelector("img")!.getAttribute("src"));
  expect(new Set(sources).size).toBeGreaterThan(1);
  for (const source of sources) expect(labyrinthShroudedArt).toContain(source);
  const tile = hidden[0]!;
  const node = props.map.nodes[tile.dataset.labyrinthNode!]!;
  const button = tile.querySelector("button")!;
  const label = button.getAttribute("aria-label");
  fireEvent.click(button);
  expect(props.onSelect).not.toHaveBeenCalled();
  expect(button.getAttribute("aria-disabled")).toBe("true");

  node.type = "mystery";
  delete node.enemyId;
  props.rerender();
  expect(tile.querySelector("img")!.getAttribute("src")).toBe(sources[0]);
  expect(button.getAttribute("aria-label")).toBe(label);

  // Clearing an adjacent room reveals the encounter without changing its identity.
  const neighbor = props.nodes.find(
    (candidate) =>
      Math.abs(candidate.gridPosition.row - node.gridPosition.row) +
        Math.abs(candidate.gridPosition.col - node.gridPosition.col) ===
      1,
  )!;
  neighbor.cleared = true;
  props.rerender();
  expect(tile.querySelector("img")!.getAttribute("src")).toBe(mysteryBg);
  expect(button.getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(button);
  expect(props.onSelect).toHaveBeenCalledWith(node.id);
});
