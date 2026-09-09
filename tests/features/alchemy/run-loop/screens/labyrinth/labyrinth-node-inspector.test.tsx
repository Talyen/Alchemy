import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabyrinthNodeInspector } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-node-inspector";
import { hexLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-hex-map";
import { keywordDefinitions } from "@/lib/game-data";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { buildSmoothShineGradient } from "@/lib/animation/shine-gradient";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";

afterEach(cleanup);

function renderInspector(overrides: Partial<LabyrinthNode> = {}) {
  const map: LabyrinthMap = hexLabyrinthMapFixture();
  const node: LabyrinthNode = { ...map.nodes["labyrinth-floor-1-n0"]!, ...overrides };
  if (!["combat", "elite", "boss"].includes(node.type)) delete node.enemyId;
  map.nodes[node.id] = node;
  const onEnter = vi.fn();
  const onDescend = vi.fn();
  render(<LabyrinthNodeInspector node={node} map={map} onEnter={onEnter} onDescend={onDescend} />);
  return { onEnter, onDescend };
}

describe("Labyrinth inspector", () => {
  it("uses standard keyword descriptions, multi-keyword text shine and trait icons", () => {
    renderInspector({ modifiers: ["caustic"], rewardModifiers: ["alchemist"] });
    expect(screen.getByRole("heading", { name: "Goblin" })).toBeTruthy();
    expect(screen.getByTestId("chamber-art").contains(screen.getByRole("heading", { name: "Goblin" }))).toBe(true);
    expect(screen.getByText("Poison").className).toContain(keywordDefinitions.poison.colorClass);
    expect(screen.getByText("Armor").className).toContain(keywordDefinitions.armor.colorClass);
    const heading = screen.getByText("Caustic");
    const expected = document.createElement("span");
    expected.style.backgroundImage = buildSmoothShineGradient(getKeywordTextShineColors(["poison", "armor"]))!;
    expect(heading.style.backgroundImage).toBe(expected.style.backgroundImage);
    expect(screen.getByText("Alchemist").className).toContain("boss-title-shine");
    expect(heading.closest("h3")?.parentElement?.parentElement?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it("shows one name for noncombat rooms and enters only through the action", () => {
    const { onEnter } = renderInspector({ type: "rest" });
    expect(screen.getAllByText("Campfire")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("chamber-art"));
    expect(onEnter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rest" }));
    expect(onEnter).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /Close/ })).toBeNull();
  });

  it("offers deliberate descent at a cleared boss and explains the unfinished rooms", () => {
    const { onEnter, onDescend } = renderInspector({ type: "boss", enemyId: "forge-golem", cleared: true });
    expect(screen.getByRole("heading", { name: "The Forge Golem" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fight" })).toBeNull();
    expect(screen.getByText("Leave 2 unexplored chambers behind.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descend" }));
    expect(onDescend).toHaveBeenCalledOnce();
    expect(onEnter).not.toHaveBeenCalled();
  });
});
