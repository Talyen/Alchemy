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

  it("renders grayscale when undiscovered and no tile button", () => {
    const { container } = render(
      <CompanionCardNode
        card={wolfCard}
        discovered={false}
        bondedCompanions={{} as any}
        materialInventory={emptyInventory()}
        onBond={vi.fn()}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.className).toContain("grayscale");
    expect(img?.className).toContain("group-hover:grayscale-0");
    expect(img?.className).toContain("group-hover:opacity-100");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders clickable art tile when discovered and affordable", () => {
    const onBond = vi.fn();
    const inventory = { ...emptyInventory(), food: 100 };
    render(
      <CompanionCardNode
        card={wolfCard}
        discovered
        bondedCompanions={{} as any}
        materialInventory={inventory}
        onBond={onBond}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(btn);
    expect(onBond).toHaveBeenCalled();
  });

  it("marks tile aria-disabled and ignores clicks when unaffordable", () => {
    const onBond = vi.fn();
    render(
      <CompanionCardNode
        card={wolfCard}
        discovered
        bondedCompanions={{} as any}
        materialInventory={emptyInventory()}
        onBond={onBond}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(onBond).not.toHaveBeenCalled();
  });

  it("renders art-only tile without button when complete", () => {
    render(
      <CompanionCardNode
        card={wolfCard}
        discovered
        bondedCompanions={{ wolf: 3 } as any}
        materialInventory={emptyInventory()}
        onBond={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(wolfCard.title)).toBeNull();
  });
});
