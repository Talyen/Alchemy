import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanionCardNode } from "@/features/alchemy/meta/screens/homestead/companion-node";
import { emptyInventory } from "@/lib/homestead/inventory";
import { cardLibrary } from "@/lib/game-data";

const wolfCard = cardLibrary.find((c) =>
  c.effects.some(
    (e) => (e as { kind: string }).kind === "summon-companion" && (e as { companionId: string }).companionId === "wolf",
  ),
)!;

describe("CompanionCardNode", () => {
  afterEach(() => cleanup());

  it("renders grayscale when undiscovered and no footer button", () => {
    const { container } = render(
      <CompanionCardNode
        card={wolfCard}
        discovered={false}
        bondedCompanions={{} as any}
        materialInventory={emptyInventory()}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onBond={vi.fn()}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.className).toContain("grayscale");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders afford button when discovered and affordable", () => {
    const onBond = vi.fn();
    const inventory = { ...emptyInventory(), food: 100 };
    render(
      <CompanionCardNode
        card={wolfCard}
        discovered
        bondedCompanions={{} as any}
        materialInventory={inventory}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onBond={onBond}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(btn);
    expect(onBond).toHaveBeenCalled();
  });

  it("disables bond button when unaffordable", () => {
    render(
      <CompanionCardNode
        card={wolfCard}
        discovered
        bondedCompanions={{} as any}
        materialInventory={emptyInventory()}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onBond={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("renders completed state without button", () => {
    render(
      <CompanionCardNode
        card={wolfCard}
        discovered
        bondedCompanions={{ wolf: 3 } as any}
        materialInventory={emptyInventory()}
        hoveredItemId={null}
        setHoveredItemId={vi.fn()}
        onBond={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(wolfCard.title)).toBeTruthy();
  });
});
