import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabyrinthNodeInspector } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-node-inspector";
import { hexLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-hex-map";
import type { LabyrinthNode } from "@/lib/content-systems/types";

afterEach(cleanup);

function renderInspector(overrides: Partial<LabyrinthNode> = {}, canEnter = true) {
  const onEnter = vi.fn();
  const onClose = vi.fn();
  const node: LabyrinthNode = { ...hexLabyrinthMapFixture().nodes["labyrinth-floor-1-n0"], ...overrides };
  if (!["combat", "elite", "boss"].includes(node.type)) delete node.enemyId;
  render(<LabyrinthNodeInspector node={node} canEnter={canEnter} onEnter={onEnter} onClose={onClose} />);
  return { onEnter, onClose };
}

describe("Labyrinth inspector", () => {
  it("places combat category and enemy name outside the artwork without narrative", () => {
    renderInspector({ modifiers: ["jealous"], rewardModifiers: ["alchemist"] });
    expect(screen.getByRole("heading", { name: "Goblin" })).toBeTruthy();
    expect(screen.getAllByText("Normal Combat")).toHaveLength(1);
    expect(screen.getByTestId("chamber-art").textContent).toBe("");
    expect(screen.queryByText("Fight a standard enemy encounter")).toBeNull();
    expect(screen.getByText("Jealous")).toBeTruthy();
    expect(screen.getByText("Alchemist")).toBeTruthy();
  });

  it.each(["shop", "alchemist", "trinket-shop", "equipment-shop"] as const)("groups %s under Merchant", (type) => {
    renderInspector({ type });
    expect(screen.getAllByText("Merchant")).toHaveLength(1);
    expect(screen.getByRole("heading").textContent).not.toBe("Merchant");
    expect(screen.queryByText("Buy trinkets for your armory")).toBeNull();
  });

  it("shows a single label when no distinct chamber name exists", () => {
    renderInspector({ type: "rest" });
    expect(screen.getAllByText("Campfire")).toHaveLength(1);
  });

  it("only enters through the action and provides explicit dismissal", () => {
    const { onEnter, onClose } = renderInspector();
    fireEvent.click(screen.getByTestId("chamber-art"));
    expect(onEnter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fight" }));
    expect(onEnter).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Close chamber details" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps a locked boss inspectable without a Fight action", () => {
    renderInspector({ type: "boss", enemyId: "forge-golem" }, false);
    expect(screen.getByRole("heading", { name: "The Forge Golem" })).toBeTruthy();
    expect(screen.getByText("Boss Combat")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fight" })).toBeNull();
  });
});
