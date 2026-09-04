import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadUpgradeNode } from "@/features/alchemy/meta/screens/homestead/upgrade-node";
import { buildings } from "@/lib/homestead/data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { GoalItem } from "@/features/alchemy/meta/screens/homestead/helpers";

const buildingItem: GoalItem = { kind: "building", data: buildings[0]! };

describe("HomesteadUpgradeNode", () => {
  afterEach(() => cleanup());

  it("renders clickable art tile when affordable and fires onAction", () => {
    const onAction = vi.fn();
    const inventory = { ...emptyInventory(), iron: 100 };
    const { container } = render(
      <HomesteadUpgradeNode item={buildingItem} currentLevel={0} materialInventory={inventory} onAction={onAction} />,
    );
    const btn = screen.getByRole("button", { name: /Blacksmith/ });
    expect(btn.getAttribute("aria-disabled")).toBe("false");
    expect(container.querySelector(".card-interactive-glow")).toBeTruthy();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith(buildingItem);
  });

  it("marks tile aria-disabled, removes glow, and ignores clicks when unaffordable", () => {
    const onAction = vi.fn();
    const inventory = emptyInventory();
    const { container } = render(
      <HomesteadUpgradeNode item={buildingItem} currentLevel={0} materialInventory={inventory} onAction={onAction} />,
    );
    const btn = screen.getByRole("button", { name: /Blacksmith/ });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector(".card-interactive-glow")).toBeNull();
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

  it("applies tier0 dim to image", () => {
    const { container } = render(
      <HomesteadUpgradeNode
        item={buildingItem}
        currentLevel={0}
        materialInventory={emptyInventory()}
        onAction={vi.fn()}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.className).toContain("grayscale");
    expect(img?.className).toContain("group-hover:grayscale-0");
    expect(img?.className).toContain("group-hover:opacity-100");
  });

  it("does not apply tier0 dim when already leveled", () => {
    const inventory = { ...emptyInventory(), iron: 100 };
    const { container } = render(
      <HomesteadUpgradeNode item={buildingItem} currentLevel={1} materialInventory={inventory} onAction={vi.fn()} />,
    );
    const img = container.querySelector("img");
    expect(img?.className).not.toContain("opacity-60");
  });
});
