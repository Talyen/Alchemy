import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import { LabyrinthMapScreen } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-screen";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";

vi.mock("@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-viewport", () => ({
  LabyrinthMapViewport: ({ nodes, onSelect }: { nodes: LabyrinthNode[]; onSelect: (id: string) => void }) => (
    <div>
      {nodes.map((node) => (
        <button key={node.id} onClick={() => onSelect(node.id)}>
          {node.id}
        </button>
      ))}
    </div>
  ),
}));

afterEach(cleanup);

it("enters the clicked reachable room immediately and rejects hidden, current and distant rooms", () => {
  const map = gridLabyrinthMapFixture();
  const calls: string[] = [];
  render(
    <LabyrinthMapScreen
      labyrinthMap={map}
      heroArt="/knight.webp"
      selectedNodeId="labyrinth-floor-1-n14"
      onNodeSelect={(id) => calls.push(id)}
      onNodeDeselect={vi.fn()}
      onNodeEnter={() => calls.push("enter")}
      onDescend={() => calls.push("descend")}
    />,
  );
  for (const id of [map.currentNodeId, "labyrinth-floor-1-n1", "labyrinth-floor-1-n14"])
    fireEvent.click(screen.getByRole("button", { name: id }));
  expect(calls).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "labyrinth-floor-1-n0" }));
  expect(calls).toEqual(["labyrinth-floor-1-n0", "enter"]);
});

it("descends directly from a completed boss, including when it is the current hero node", () => {
  const map = gridLabyrinthMapFixture();
  const boss = map.nodes["labyrinth-floor-1-n14"]!;
  boss.cleared = true;
  map.currentNodeId = boss.id;
  const calls: string[] = [];
  render(
    <LabyrinthMapScreen
      labyrinthMap={map}
      heroArt="/knight.webp"
      selectedNodeId={null}
      onNodeSelect={(id) => calls.push(id)}
      onNodeDeselect={vi.fn()}
      onNodeEnter={() => calls.push("enter")}
      onDescend={() => calls.push("descend")}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: boss.id }));
  expect(calls).toEqual([boss.id, "descend"]);
});
