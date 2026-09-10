import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionCardNode } from "@/features/alchemy/meta/screens/homestead/companion-node";
import { emptyInventory } from "@/lib/homestead/inventory";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { cardLibrary } from "@/lib/game-data";

const wolfCard = cardLibrary.find((c) =>
  c.effects.some(
    (e) => (e as { kind: string }).kind === "summon-companion" && (e as { companionId: string }).companionId === "wolf",
  ),
)!;

describe("CompanionCardNode", () => {
  beforeEach(() => useUiStore.setState({ hoveredCardId: null, shimmerState: null }));
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
    const { container } = render(
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
    expect(container.querySelector(".card-interactive-glow")).toBeTruthy();
    fireEvent.click(btn);
    expect(onBond).toHaveBeenCalled();
  });

  it("keeps glow when unaffordable and ignores clicks", () => {
    const onBond = vi.fn();
    const { container } = render(
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
    expect(container.querySelector(".card-interactive-glow")).toBeTruthy();
    fireEvent.click(btn);
    expect(onBond).not.toHaveBeenCalled();
  });

  it("shows matching shine and glow for undiscovered companions during hover", () => {
    const inventory = { ...emptyInventory(), food: 100 };
    const discovered = render(
      <CompanionCardNode
        card={wolfCard}
        discovered
        bondedCompanions={{} as any}
        materialInventory={inventory}
        onBond={vi.fn()}
      />,
    );
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button.parentElement!);
    const discoveredColor = button.querySelector<HTMLElement>(".shine-border-paint")?.style.backgroundColor;
    expect(discoveredColor).toBeTruthy();
    fireEvent.mouseLeave(button.parentElement!);
    discovered.unmount();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null });

    const { container } = render(
      <CompanionCardNode
        card={wolfCard}
        discovered={false}
        bondedCompanions={{} as any}
        materialInventory={emptyInventory()}
        onBond={vi.fn()}
      />,
    );
    const surface = container.querySelector(".card-interactive-glow");
    expect(surface).toBeTruthy();
    expect(container.querySelector(".shine-border")).toBeNull();
    fireEvent.mouseEnter(surface!.parentElement!);
    expect(container.querySelector<HTMLElement>(".shine-border-paint")?.style.backgroundColor).toBe(discoveredColor);
    fireEvent.mouseLeave(surface!.parentElement!);
    expect(container.querySelector(".shine-border")).toBeNull();
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
