import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomesteadUpgradeNode } from "@/features/alchemy/meta/screens/homestead/upgrade-node";
import { buildings, researchUpgrades } from "@/lib/homestead/data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { GoalItem } from "@/features/alchemy/meta/screens/homestead/helpers";

const buildingItem: GoalItem = { kind: "building", data: buildings[0]! };

function panelText() {
  return document.querySelector(".hover-popup-panel")?.textContent ?? "";
}

describe("HomesteadUpgradeNode hover tooltip", () => {
  afterEach(() => {
    cleanup();
    useUiStore.getState().clearCardHover();
  });

  it("shows title and build cost on mouse enter", async () => {
    render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={0}
        materialInventory={{ ...emptyInventory(), iron: 100 }}
        onAction={() => {}}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Blacksmith/ }).parentElement as HTMLElement;
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      const panel = document.querySelector(".hover-popup-panel[data-visible]");
      expect(panel).toBeTruthy();
      expect(panelText()).toContain("Blacksmith");
      expect(panelText()).toContain("Build");
      expect(panelText()).toContain("22");

      const header = panel?.querySelector("p.font-bold");
      expect(header?.textContent).toBe("Blacksmith");
      expect(header?.querySelector("svg")).toBeNull();

      const subheader = panel?.querySelector("p.uppercase");
      expect(subheader?.textContent).toContain("Build");
      expect(subheader?.querySelectorAll("svg").length).toBe(buildingItem.data.tiers.length);
    });
  });

  it("hides tooltip content on mouse leave", async () => {
    render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={0}
        materialInventory={{ ...emptyInventory(), iron: 100 }}
        onAction={() => {}}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Blacksmith/ }).parentElement as HTMLElement;
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(panelText()).toContain("Build");
    });

    fireEvent.mouseLeave(trigger);

    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeNull();
    });
  });

  it("shows Max Level with all stars filled when completed", async () => {
    const maxLevel = buildingItem.data.tiers.length;
    const { container } = render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={maxLevel}
        materialInventory={emptyInventory()}
        onAction={() => {}}
      />,
    );

    const trigger = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
      expect(panelText()).toContain("Blacksmith");
      expect(panelText()).toContain("Max Level");
    });
  });

  it("does not duplicate non-combat descriptions in upgrade tooltips", async () => {
    const leylineItem: GoalItem = { kind: "research", data: researchUpgrades.find((r) => r.id === "leyline-energy")! };
    render(
      <HomesteadUpgradeNode
        item={leylineItem}
        currentLevel={1}
        materialInventory={{ ...emptyInventory(), gems: 100 }}
        onAction={() => {}}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Leyline Energy/ }).parentElement as HTMLElement;
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });

    const text = panelText();
    const occurrences = (text.match(/per Room/g) || []).length;
    expect(occurrences).toBe(1);
  });
});
