import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LabyrinthNodeTooltip } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-node-tooltip";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";

afterEach(cleanup);

function renderTooltip(overrides: Partial<LabyrinthNode> = {}) {
  const map: LabyrinthMap = gridLabyrinthMapFixture();
  const node: LabyrinthNode = { ...map.nodes["labyrinth-floor-1-n0"]!, ...overrides };
  if (!["combat", "elite", "boss"].includes(node.type)) delete node.enemyId;
  map.nodes[node.id] = node;
  if (node.type === "boss" && node.cleared) map.currentNodeId = node.id;
  render(<LabyrinthNodeTooltip node={node} />);
}

describe("Labyrinth tooltip", () => {
  it("explains the enemy, combat modifiers, and rewards without interactive controls", () => {
    renderTooltip({ modifiers: ["caustic", "flesheater"], rewardModifiers: ["alchemist"] });
    expect(screen.getByText("Goblin")).toBeTruthy();
    for (const name of ["Caustic", "Flesheater", "Alchemist"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByText("Poison")).toBeTruthy();
    expect(screen.getByText("Armor")).toBeTruthy();
    expect(document.querySelector('[data-trait="flesheater"] p')?.textContent).toBe(
      "Deals 1 Bleed damage each turn\nLeech",
    );
    expect(document.querySelector("img,button")).toBeNull();
  });

  it("shows only the encounter name for a room without modifiers", () => {
    renderTooltip({ type: "rest", modifiers: [], rewardModifiers: [] });
    expect(screen.getAllByText("Campfire")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});
