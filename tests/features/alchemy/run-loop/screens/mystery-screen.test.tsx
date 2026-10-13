import "../../../../helpers/mock-audio";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MysteryScreen } from "@/features/alchemy/run-loop/screens/mystery/mystery-screen";
import { cardById } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { findMysteryEvent, type MysteryEvent, type MysteryChoice } from "@/lib/mystery";
import { computeGoldReward, computeMysteryMaterialReward } from "@/lib/homestead/material-rewards";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
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

  it("previews exact boosted rewards without changing the choice submitted for purchase", async () => {
    const offered: MysteryEvent = {
      id: "treasure",
      title: "Treasure",
      art: "",
      narrative: "Treasure",
      choices: [
        {
          label: "Take",
          effects: [
            { kind: "gainGold", amount: 3 },
            { kind: "gainMaterial", material: "gems", amount: 10 },
          ],
        },
      ],
    };
    const onChoose = vi.fn((_choice: MysteryChoice) => true);
    const effects = { ...defaultHomesteadEffects, goldFindBonus: 0.1, gemFindBonus: 0.4 };
    render(
      <MysteryScreen
        {...props}
        event={offered}
        onChoose={onChoose}
        previewEffect={(effect) => {
          if (effect.kind === "gainGold")
            return { ...effect, amount: computeGoldReward(effect.amount, 1.5, effects.goldFindBonus) };
          if (effect.kind === "gainMaterial")
            return { ...effect, amount: computeMysteryMaterialReward({ ...effect, effects })[effect.material] };
          return effect;
        }}
      />,
    );
    const choice = screen.getByRole("button", { name: "Take" });
    fireEvent.mouseEnter(choice.parentElement!);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("6 Gold");
    expect(tooltip.textContent).toContain("14 Gems");
    fireEvent.click(choice);
    expect(onChoose.mock.calls[0]?.[0]).toBe(offered.choices[0]);
    expect(offered.choices[0]?.effects).toEqual([
      { kind: "gainGold", amount: 3 },
      { kind: "gainMaterial", material: "gems", amount: 10 },
    ]);
  });

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
