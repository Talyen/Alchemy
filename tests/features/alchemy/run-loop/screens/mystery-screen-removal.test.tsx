// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MysteryScreen } from "@/features/alchemy/run-loop/screens/mystery/mystery-screen";
import type { BattleCard } from "@/lib/game-data";
import type { MysteryEvent } from "@/lib/mystery";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const sampleEvent: MysteryEvent = {
  id: "ancient-altar",
  title: "Ancient Altar",
  art: "altar-art",
  narrative: "A weathered stone altar stands beneath a shaft of light.",
  choices: [
    {
      label: "Make an Offering",
      effects: [{ kind: "removeCard", mode: "choose" }],
    },
    {
      label: "Sacrifice Gold and Offering",
      effects: [
        { kind: "removeCard", mode: "choose" },
        { kind: "gainGold", amount: 50 },
      ],
    },
  ],
};

const sampleDeck: BattleCard[] = [
  {
    id: "strike-1",
    title: "Strike",
    descriptionLines: ["Deal 6 damage."],
    art: "",
    cost: 1,
    type: "attack",
    effects: [],
  } as unknown as BattleCard,
];

describe("MysteryScreen Card Removal Flow", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("bypasses reward summary and calls onContinue directly when choice only removes a card", () => {
    const onChoose = vi.fn();
    const onRemoveCard = vi.fn();
    const onContinue = vi.fn();

    render(
      <MysteryScreen
        event={sampleEvent}
        runDeck={sampleDeck}
        mysteryCardChoices={null}
        mysteryGrantedTrinketIds={[]}
        onChoose={onChoose}
        onChooseCard={vi.fn()}
        onRemoveCard={onRemoveCard}
        onContinue={onContinue}
        findCard={() => undefined}
        findTrinket={() => undefined}
      />,
    );

    // Pick "Make an Offering"
    fireEvent.click(screen.getByRole("button", { name: "Make an Offering" }));
    expect(onChoose).toHaveBeenCalledWith(sampleEvent.choices[0]);

    // Removal grid is displayed
    const selectCardBtn = screen.getByRole("button", { name: "Select Strike" });
    expect(selectCardBtn).toBeTruthy();
    fireEvent.click(selectCardBtn);

    // Click "Remove Card" button
    fireEvent.click(screen.getByRole("button", { name: /Remove Card/i }));

    expect(onRemoveCard).toHaveBeenCalledWith(0);
    // onContinue is called immediately, skipping the redundant Ancient Altar + Continue screen
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("shows reward summary when choice has additional displayable rewards besides card removal", () => {
    const onChoose = vi.fn();
    const onRemoveCard = vi.fn();
    const onContinue = vi.fn();

    render(
      <MysteryScreen
        event={sampleEvent}
        runDeck={sampleDeck}
        mysteryCardChoices={null}
        mysteryGrantedTrinketIds={[]}
        onChoose={onChoose}
        onChooseCard={vi.fn()}
        onRemoveCard={onRemoveCard}
        onContinue={onContinue}
        findCard={() => undefined}
        findTrinket={() => undefined}
      />,
    );

    // Pick "Sacrifice Gold and Offering"
    fireEvent.click(screen.getByRole("button", { name: "Sacrifice Gold and Offering" }));

    // Removal grid is displayed
    const selectCardBtn = screen.getByRole("button", { name: "Select Strike" });
    fireEvent.click(selectCardBtn);

    // Click "Remove Card" button
    fireEvent.click(screen.getByRole("button", { name: /Remove Card/i }));

    expect(onRemoveCard).toHaveBeenCalledWith(0);
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Ancient Altar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });
});
