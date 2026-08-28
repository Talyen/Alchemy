import { cleanup, render, screen } from "@testing-library/react";
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

  it("uses scale-only hover motion without enabling tilt", () => {
    render(<BattleCardButton card={card} ariaLabel="Test Card" shimmerActive={false} shimmerToken={undefined} />);

    const button = screen.getByRole("button", { name: "Test Card" });
    expect(button.classList.contains("card-hover-scale")).toBe(true);
    expect(button.getAttribute("data-tilt-strength")).toBeNull();
  });

  it("allows custom-transform cards to opt out of the shared scale", () => {
    render(
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
});
