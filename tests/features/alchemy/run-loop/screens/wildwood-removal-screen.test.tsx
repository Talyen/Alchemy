import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WildwoodRemovalScreen } from "@/features/alchemy/run-loop/screens/wildwood-removal-screen";
import type { BattleCard } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const testCard: BattleCard = {
  id: "strike-1",
  title: "Strike",
  descriptionLines: ["Deal 6 damage."],
  art: "",
  cost: 1,
  effects: [],
};

describe("WildwoodRemovalScreen", () => {
  installDisabledAnimationsForTests();

  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders screen title and deck cards for removal", () => {
    render(<WildwoodRemovalScreen runDeck={[testCard]} onRemove={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Refine Your Deck" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select Strike" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
  });

  it("calls onSkip when Skip button is clicked", () => {
    const onSkip = vi.fn();
    render(<WildwoodRemovalScreen runDeck={[testCard]} onRemove={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("calls onRemove with card index when a card is selected and confirmed", () => {
    const onRemove = vi.fn();
    render(<WildwoodRemovalScreen runDeck={[testCard]} onRemove={onRemove} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select Strike" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Card" }));

    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
