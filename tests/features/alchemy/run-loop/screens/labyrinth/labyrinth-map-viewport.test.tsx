import { cleanup, fireEvent, render } from "@testing-library/react";
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
  render(<LabyrinthMapViewport {...props} />);
  return props;
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
