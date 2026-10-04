import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompanionCardNode } from "@/features/alchemy/meta/screens/homestead/companion-node";
import { emptyInventory } from "@/lib/homestead/inventory";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { cardById, defaultCompanionBondLevels } from "@/lib/game-data";

const props = {
  card: cardById["wolf-companion"]!,
  discovered: true,
  bondedCompanions: { ...defaultCompanionBondLevels },
  materialInventory: emptyInventory(),
};

afterEach(() => {
  cleanup();
  useUiStore.getState().clearCardHover();
});

it("rejects an unaffordable bond and dispatches the right Companion when affordable", () => {
  const onBond = vi.fn();
  const { rerender } = render(<CompanionCardNode {...props} onBond={onBond} />);
  fireEvent.click(screen.getByRole("button"));
  expect(onBond).not.toHaveBeenCalled();

  rerender(<CompanionCardNode {...props} materialInventory={{ ...emptyInventory(), food: 100 }} onBond={onBond} />);
  fireEvent.click(screen.getByRole("button"));
  expect(onBond).toHaveBeenCalledExactlyOnceWith("wolf");
});

it.each([
  { discovered: false, level: 0 },
  { discovered: true, level: 3 },
])("does not offer a bond for discovered=$discovered, level=$level", ({ discovered, level }) => {
  render(
    <CompanionCardNode
      {...props}
      discovered={discovered}
      bondedCompanions={{ ...defaultCompanionBondLevels, wolf: level }}
      materialInventory={{ ...emptyInventory(), food: 100 }}
      onBond={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
});
