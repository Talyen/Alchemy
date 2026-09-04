import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MysteryScreen } from "@/features/alchemy/run-loop/screens/mystery/mystery-screen";
import type { BattleCard } from "@/lib/game-data";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const event: MysteryEvent = {
  id: "ancient-altar",
  title: "Ancient Altar",
  art: "altar-art",
  narrative: "A weathered stone altar stands beneath a shaft of light.",
  choices: [],
};

const deck: BattleCard[] = [
  { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "", cost: 1, effects: [] },
];

function renderPendingRemoval(choice: MysteryChoice) {
  const onRemoveCard = vi.fn();
  const onContinue = vi.fn();
  render(
    <MysteryScreen
      event={event}
      runDeck={deck}
      mysteryCardChoices={null}
      mysteryGrantedTrinketIds={[]}
      mysteryGrantedGearInstances={[]}
      mysteryChosenCardId={null}
      mysteryChosenChoice={choice}
      mysteryPendingRemoval
      onChoose={vi.fn()}
      onChooseCard={vi.fn()}
      onRemoveCard={onRemoveCard}
      onContinue={onContinue}
      findCard={() => undefined}
      findTrinket={() => undefined}
    />,
  );
  return { onRemoveCard, onContinue };
}

describe("legacy mystery card removal", () => {
  installDisabledAnimationsForTests();

  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets the player finish a removal-only visit and continue", () => {
    const callbacks = renderPendingRemoval({ label: "Offer", effects: [{ kind: "removeCard" }] });

    fireEvent.click(screen.getByRole("button", { name: "Select Slash" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Card" }));

    expect(callbacks.onRemoveCard).toHaveBeenCalledWith(0);
    expect(callbacks.onContinue).toHaveBeenCalledOnce();
  });
});
