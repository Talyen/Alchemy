import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BattleCardButton } from "@/features/alchemy/shared/ui/card-button";
import type { BattleCard } from "@/lib/game-data";

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

  it("uses scale-only hover motion unless a custom transform opts out", () => {
    const { rerender } = render(
      <BattleCardButton card={card} ariaLabel="Test Card" shimmerActive={false} shimmerToken={undefined} />,
    );
    expect(screen.getByRole("button", { name: "Test Card" }).classList.contains("card-hover-scale")).toBe(true);

    rerender(
      <BattleCardButton
        card={card}
        ariaLabel="Test Card"
        shimmerActive={false}
        shimmerToken={undefined}
        scaleOnHover={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Test Card" }).classList.contains("card-hover-scale")).toBe(false);
  });

  it("pairs keyword shine without glow only while eligible for hover", () => {
    const props = {
      ariaLabel: "Test Card",
      shimmerActive: false,
      shimmerToken: undefined,
      onHoverStart: () => {},
      onHoverEnd: () => {},
      card,
      shineColor: ["#ff0000", "#00ff00"],
      scaleOnHover: false,
    };
    const { container, rerender } = render(<BattleCardButton {...props} hovered />);
    expect(container.querySelector(".shine-border")).not.toBeNull();
    expect(container.querySelector(".shine-border")?.hasAttribute("data-glow")).toBe(false);
    for (const state of [{ hovered: false }, { hovered: true, disabled: true }, { hovered: true, dragging: true }]) {
      rerender(<BattleCardButton {...props} {...state} />);
      expect(container.querySelector(".shine-border")).toBeNull();
    }
  });
});
