import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BattleCardButton } from "@/features/alchemy/shared/ui/cards/card-button";
import { SelectableCard } from "@/features/alchemy/shared/ui/cards/selectable-card";
import { cardById, type BattleCard } from "@/lib/game-data/index";
import { strengthenPotion } from "@/lib/alchemist/brewing";

const card: BattleCard = {
  id: "test-card",
  title: "Test Card",
  descriptionLines: ["Test description."],
  art: "test-card.png",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
};

describe("BattleCardButton", () => {
  afterEach(cleanup);

  it("keeps card inspection active until both focus and pointer leave", () => {
    render(<BattleCardButton card={card} ariaLabel="Test Card" shimmerActive={false} shimmerToken={undefined} />);
    const button = screen.getByRole("button", { name: "Test Card" });
    const wrapper = button.parentElement!;
    act(() => button.focus());
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);
    expect(button.dataset.hovered).toBe("true");
    fireEvent.mouseEnter(wrapper);
    act(() => button.blur());
    expect(button.dataset.hovered).toBe("true");
    fireEvent.mouseLeave(wrapper);
    expect(button.dataset.hovered).toBeUndefined();
  });

  it("keeps unavailable card choices inspectable by keyboard without selecting them", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<SelectableCard card={card} isSelected={false} disabled onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: "Select Test Card" });
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("tooltip").textContent).toContain("Test description.");
    fireEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
    rerender(<SelectableCard card={card} isSelected={false} onSelect={onSelect} />);
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("renders distilled potion values with green highlighting in popup", () => {
    const distilledHealthPotion = strengthenPotion(cardById["health-potion"]!)!;
    render(
      <BattleCardButton
        card={distilledHealthPotion}
        ariaLabel="Health Potion"
        shimmerActive={false}
        shimmerToken={undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Health Potion" });
    act(() => button.focus());
    const tooltip = screen.getByRole("tooltip");
    const greenSpan = tooltip.querySelector(".text-green-400");
    expect(greenSpan).not.toBeNull();
  });
});
