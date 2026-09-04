import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomesteadTooltipCost } from "@/features/alchemy/meta/screens/homestead/homestead-tile-node";
import { HomesteadUpgradeNode } from "@/features/alchemy/meta/screens/homestead/upgrade-node";
import { buildings } from "@/lib/homestead/data";
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
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
      expect(panelText()).toContain("Blacksmith");
      expect(panelText()).toContain("Build");
      expect(panelText()).toContain("20");
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
});

describe("HomesteadTooltipCost", () => {
  afterEach(cleanup);

  it("renders label with cost icons and amounts", () => {
    render(
      <HomesteadTooltipCost
        label="Build"
        cost={{ ...emptyInventory(), wood: 5, iron: 3 }}
        inventory={{ ...emptyInventory(), wood: 10, iron: 10 }}
      />,
    );

    expect(screen.getByText("Build")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("marks unaffordable amounts destructive without a message", () => {
    const { container } = render(
      <HomesteadTooltipCost
        label="Upgrade"
        cost={{ ...emptyInventory(), wood: 5, iron: 3 }}
        inventory={{ ...emptyInventory(), wood: 10, iron: 1 }}
      />,
    );

    expect(screen.getByText("Upgrade")).toBeTruthy();
    expect(screen.queryByText(/not enough/i)).toBeNull();
    expect(container.querySelector(".text-destructive")?.textContent).toContain("3");
  });

  it("renders nothing when the cost is empty", () => {
    const { container } = render(
      <HomesteadTooltipCost label="Build" cost={emptyInventory()} inventory={emptyInventory()} />,
    );

    expect(container.textContent).toBe("");
  });
});
