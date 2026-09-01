import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadUpgradeNode } from "@/features/alchemy/meta/screens/homestead/upgrade-node";
import { buildings } from "@/lib/homestead/data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { GoalItem } from "@/features/alchemy/meta/screens/homestead/helpers";

const buildingItem: GoalItem = { kind: "building", data: buildings[0]! };

describe("HomesteadUpgradeNode", () => {
  afterEach(() => cleanup());

  it("renders afford button when affordable and fires onAction", () => {
    const onAction = vi.fn();
    const inventory = { ...emptyInventory(), iron: 100 };
    render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={0}
        materialInventory={inventory}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onAction={onAction}
      />,
    );
    const btn = screen.getByRole("button", { name: /Blacksmith/ });
    expect(btn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith(buildingItem);
  });

  it("disables button when unaffordable", () => {
    const inventory = emptyInventory();
    render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={0}
        materialInventory={inventory}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Blacksmith/ });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("renders completed footer when at max tier", () => {
    const maxLevel = buildingItem.data.tiers.length;
    render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={maxLevel}
        materialInventory={emptyInventory()}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(buildingItem.data.title)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("applies tier0 dim to image", () => {
    const { container } = render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={0}
        materialInventory={emptyInventory()}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.className).toContain("grayscale");
  });

  it("does not apply tier0 dim when already leveled", () => {
    const inventory = { ...emptyInventory(), iron: 100 };
    const { container } = render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={1}
        materialInventory={inventory}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.className).not.toContain("opacity-60");
  });
});
