// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemoveCardPanel } from "@/features/alchemy/shared/ui/remove-card-panel";
import type { BattleCard } from "@/lib/game-data";

const runDeck: BattleCard[] = [
  {
    id: "strike-1",
    title: "Strike",
    descriptionLines: ["Deal 6 damage."],
    art: "card-art-1",
    cost: 1,
    type: "attack",
    effects: [],
  } as unknown as BattleCard,
  {
    id: "defend-1",
    title: "Defend",
    descriptionLines: ["Gain 5 block."],
    art: "card-art-2",
    cost: 1,
    type: "skill",
    effects: [],
  } as unknown as BattleCard,
];

describe("RemoveCardPanel Card Tooltips in Grid", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders card tooltips on top row cards when focused or hovered", () => {
    const onConfirm = vi.fn();

    render(<RemoveCardPanel runDeck={runDeck} intro={<p>Select a card to remove</p>} onConfirm={onConfirm} />);

    const topRowCardButton = screen.getByRole("button", { name: "Select Strike" });
    expect(topRowCardButton).toBeTruthy();

    fireEvent.focus(topRowCardButton);

    const descriptionSpan = screen.getByText(/Deal/);
    expect(descriptionSpan).toBeTruthy();

    // Card popups render root-scale in the tooltip overlay (document.body when
    // the overlay root is not mounted), not inside the grid item.
    const tooltipPanel = descriptionSpan.closest(".hover-popup-panel");
    expect(tooltipPanel).toBeTruthy();
    expect(document.querySelector(".hover-popup-panel.pointer-events-auto")).toBeTruthy();
  });
});
