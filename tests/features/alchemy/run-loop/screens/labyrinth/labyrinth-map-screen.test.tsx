import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Labyrinth map screen", () => {
  it("clears a stale selection as soon as its chamber becomes unavailable", () => {
    const map = productionHexLabyrinthMapFixture();
    const onNodeDeselect = vi.fn();
    const props = {
      labyrinthMap: map,
      selectedNodeId: "labyrinth-floor-2-n0",
      onNodeSelect: vi.fn(),
      onNodeDeselect,
      onNodeEnter: vi.fn(),
    };
    const { rerender } = render(<LabyrinthMapScreen {...props} />);
    expect(screen.getByRole("complementary", { name: "Chamber details" })).toBeTruthy();
    const nextMap = structuredClone(map);
    nextMap.nodes[props.selectedNodeId]!.cleared = true;
    rerender(<LabyrinthMapScreen {...props} labyrinthMap={nextMap} />);
    expect(screen.queryByRole("complementary", { name: "Chamber details" })).toBeNull();
    expect(onNodeDeselect).toHaveBeenCalledOnce();
  });

  it("follows automatic advancement and dismisses the prior floor selection", () => {
    vi.useFakeTimers();
    const map = productionHexLabyrinthMapFixture();
    map.currentFloor = 1;
    const onNodeDeselect = vi.fn();
    const props = {
      labyrinthMap: map,
      selectedNodeId: null,
      onNodeSelect: vi.fn(),
      onNodeDeselect,
      onNodeEnter: vi.fn(),
    };
    const { rerender } = render(<LabyrinthMapScreen {...props} />);
    expect(screen.getByText("Visible floor 1")).toBeTruthy();
    rerender(<LabyrinthMapScreen {...props} labyrinthMap={{ ...map, currentFloor: 2 }} />);
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.getByRole("combobox", { name: "Floor" }).textContent).toBe("Floor 2");
    expect(screen.getByText("Visible floor 2")).toBeTruthy();
    expect(onNodeDeselect).toHaveBeenCalledOnce();
  });
});
