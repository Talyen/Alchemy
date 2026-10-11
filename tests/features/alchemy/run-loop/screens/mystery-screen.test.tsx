import "../../../../helpers/mock-audio";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MysteryScreen } from "@/features/alchemy/run-loop/screens/mystery/mystery-screen";
import { cardById } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { findMysteryEvent } from "@/lib/mystery";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

vi.mock("@/features/alchemy/shared/ui/use-plasma-source", () => ({
  usePlasmaBaseline: vi.fn(),
  usePlasmaInteraction: vi.fn(),
}));
vi.mock("@/features/alchemy/run-loop/screens/mystery/mystery-deck-pickers", () => ({
  CardChoicePicker: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button onClick={() => onSelect("slash")}>Add Card</button>
  ),
}));

describe("Mystery action feedback", () => {
  installDisabledAnimationsForTests();
  beforeEach(() => vi.mocked(playUISound).mockClear());
  afterEach(cleanup);
  const event = { ...findMysteryEvent("fairy-ring")!, art: "" };
  const props = {
    event,
    mysteryCardChoices: null,
    mysteryGrantedTrinketIds: [],
    mysteryGrantedGearInstances: [],
    mysteryChosenCardId: null,
    mysteryChosenChoice: null,
    onChoose: vi.fn(() => true),
    onChooseCard: vi.fn(() => true),
    onContinue: vi.fn(),
    findCard: (id: string) => cardById[id],
    findTrinket: () => undefined,
  };

  it("shows a rejected choice and only plays success feedback after an accepted retry", () => {
    const onChoose = vi.fn(() => false);
    render(<MysteryScreen {...props} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: "Take the Gold" }));
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
    expect(playUISound).not.toHaveBeenCalledWith("talentUnlock");
    onChoose.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Take the Gold" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("talentUnlock");
  });

  it("keeps a rejected card pick open without success feedback or continuation", () => {
    const onChooseCard = vi.fn(() => false);
    const onContinue = vi.fn();
    render(
      <MysteryScreen
        {...props}
        mysteryCardChoices={[cardById.slash!]}
        mysteryChosenChoice={{ label: "Choose a Scroll", effects: [{ kind: "chooseCard" }] }}
        onChooseCard={onChooseCard}
        onContinue={onContinue}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Card" }));
    expect(onChooseCard).toHaveBeenCalledExactlyOnceWith("slash");
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
    expect(playUISound).not.toHaveBeenCalledWith("talentUnlock");
    expect(onContinue).not.toHaveBeenCalled();
  });
});
