import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomesteadUpgradeNode } from "@/features/alchemy/meta/screens/homestead/upgrade-node";
import { buildings } from "@/lib/homestead/data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { GoalItem } from "@/features/alchemy/meta/screens/homestead/helpers";

const buildingItem: GoalItem = { kind: "building", data: buildings[0]! };

describe("HomesteadUpgradeNode", () => {
  beforeEach(() => useUiStore.setState({ hoveredCardId: null, shimmerState: null }));
  afterEach(() => cleanup());

  it("renders clickable art tile when affordable and fires onAction", () => {
    const onAction = vi.fn();
    const inventory = { ...emptyInventory(), iron: 100, stone: 100 };
    const { container } = render(
      <HomesteadUpgradeNode item={buildingItem} currentLevel={0} materialInventory={inventory} onAction={onAction} />,
    );
    const btn = screen.getByRole("button", { name: /Blacksmith/ });
    expect(btn.getAttribute("aria-disabled")).toBe("false");
    expect(container.querySelector(".card-interactive-glow")).toBeTruthy();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith(buildingItem);
  });

  it("marks tile aria-disabled, keeps glow, and ignores clicks when unaffordable", () => {
    const onAction = vi.fn();
    const inventory = emptyInventory();
    const { container } = render(
      <HomesteadUpgradeNode item={buildingItem} currentLevel={0} materialInventory={inventory} onAction={onAction} />,
    );
    const btn = screen.getByRole("button", { name: /Blacksmith/ });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector(".card-interactive-glow")).toBeTruthy();
    fireEvent.click(btn);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("renders art-only tile with no button when at max tier", () => {
    const maxLevel = buildingItem.data.tiers.length;
    render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={maxLevel}
        materialInventory={emptyInventory()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(buildingItem.data.title)).toBeNull();
  });
});
