import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import { MOTION_FADE_MS } from "@/lib/game-constants";
import { LabyrinthMapScreen } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-screen";
import { productionHexLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-hex-map";

vi.mock("@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-viewport", () => ({
  LabyrinthMapViewport: ({ nodes, selectedNodeId }: { nodes: LabyrinthNode[]; selectedNodeId: string | null }) => (
    <div>
      <p>Visible floor {nodes[0]?.floor}</p>
      {selectedNodeId ? <aside aria-label="Chamber details">{selectedNodeId}</aside> : null}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("preserves completed-room inspection but dismisses selection when its floor is left", () => {
  vi.useFakeTimers();
  const map = productionHexLabyrinthMapFixture();
  map.currentFloor = 1;
  const props = {
    labyrinthMap: map,
    selectedNodeId: "labyrinth-floor-1-n0",
    onNodeSelect: vi.fn(),
    onNodeDeselect: vi.fn(),
    onNodeEnter: vi.fn(),
    onDescend: vi.fn(),
  };
  const { rerender } = render(<LabyrinthMapScreen {...props} />);
  expect(screen.getByRole("complementary", { name: "Chamber details" })).toBeTruthy();
  expect(props.onNodeDeselect).not.toHaveBeenCalled();
  rerender(<LabyrinthMapScreen {...props} labyrinthMap={{ ...map, currentFloor: 2 }} />);
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
  expect(screen.queryByRole("complementary", { name: "Chamber details" })).toBeNull();
  expect(screen.getByText("Visible floor 2")).toBeTruthy();
  expect(screen.getByRole("status", { name: "Floor 2" }).textContent).toBe("Floor 2");
  expect(props.onNodeDeselect).toHaveBeenCalledOnce();
  expect(screen.queryByRole("combobox")).toBeNull();
});
