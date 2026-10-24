import { EnemyTraits } from "@/features/alchemy/shared/ui/enemy-traits";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LabyrinthNodeTooltip } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-node-tooltip";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";
import { keywordDefinitions } from "@/lib/game-data";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { buildSmoothShineGradient } from "@/lib/animation/shine-gradient";
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
  it("uses standard keyword descriptions, multi-keyword text shine and trait icons", () => {
    renderTooltip({ modifiers: ["caustic", "flesheater"], rewardModifiers: ["alchemist"] });
    expect(screen.getByText("Goblin")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("Poison").className).toContain(keywordDefinitions.poison.colorClass);
    expect(screen.getByText("Armor").className).toContain(keywordDefinitions.armor.colorClass);
    const heading = screen.getByText("Caustic");
    const expected = document.createElement("span");
    expected.style.backgroundImage = buildSmoothShineGradient(getKeywordTextShineColors(["poison", "armor"]))!;
    expect(heading.style.backgroundImage).toBe(expected.style.backgroundImage);
    expect(screen.getByText("Alchemist").className).toContain("boss-title-shine");
    expect(document.querySelector('[data-trait="alchemist"] svg')?.getAttribute("class")).toContain(
      keywordDefinitions.consume.colorClass,
    );
    expect(document.querySelector('[data-trait="flesheater"] p')?.textContent).toBe(
      "Deals 1 Bleed damage each turn\nLeech",
    );
    const mapTrait = document.querySelector('[data-trait="caustic"]')!.outerHTML;
    const enemy = render(<EnemyTraits entry={{ traits: [] }} modifiers={["caustic"]} variant="tooltip" />);
    expect(enemy.container.querySelector('[data-trait="caustic"]')!.outerHTML).toBe(mapTrait);
    expect(heading.closest("h3")?.parentElement?.parentElement?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it("shows only the encounter name for a room without modifiers", () => {
    renderTooltip({ type: "rest", modifiers: [], rewardModifiers: [] });
    expect(screen.getAllByText("Campfire")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});
