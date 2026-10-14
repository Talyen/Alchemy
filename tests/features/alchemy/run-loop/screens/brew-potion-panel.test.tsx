import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrewPotionPanel } from "@/features/alchemy/run-loop/screens/brew-potion-panel";
import { cardById, type BattleCard } from "@/lib/game-data";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { resetEscapeStackForTests } from "@/app/escape-stack";
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => ({
  SelectableCard: ({ card, onSelect }: { card: BattleCard; onSelect: () => void }) => (
    <button onClick={onSelect}>Select {card.title}</button>
  ),
}));
vi.mock(
  "@/features/alchemy/shared/ui/cards/card-selection-grid",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
});
describe("Brew selection safety", () => {
  installDisabledAnimationsForTests();
  it("confirms a single Potion only through the Strengthen flow", () => {
    const onConfirm = vi.fn(() => null);
    render(
      <BrewPotionPanel
        deck={[cardById["health-potion"]!, cardById["mana-potion"]!, cardById["wishing-potion"]!]}
        kind="strengthen"
        onConfirm={onConfirm}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Mix" })).toBeNull();
    expect(screen.getByRole("button", { name: "Select Wishing Potion" })).toBeTruthy();
    const choice = screen.getByRole("button", { name: "Select Health Potion" });
    choice.focus();
    fireEvent.click(choice);
    expect(screen.getByRole("button", { name: "Inspect brew result: Health Potion" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Original: Health Potion" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select Health Potion" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Distill" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Another Potion" }));
    expect(screen.queryByRole("button", { name: "Inspect brew result: Health Potion" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Distill" }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({ kind: "strengthen", index: 1 });
  });
  it("requires fresh source selection if the deck changes before confirmation", () => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!];
    const onConfirm = vi.fn(() => null);
    const onBack = vi.fn();
    const { rerender } = render(<BrewPotionPanel kind="combine" deck={deck} onConfirm={onConfirm} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Health Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    expect((screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<BrewPotionPanel kind="combine" deck={[deck[1]!, deck[0]!]} onConfirm={onConfirm} onBack={onBack} />);
    expect(screen.queryByRole("button", { name: "Inspect brew result: Mixed Potion" })).toBeNull();
    expect((screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Deck changed");
    fireEvent.click(screen.getByRole("button", { name: "Mix" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("disables the confirmation button when a progress save is pending", () => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!];
    const onConfirm = vi.fn(() => null);
    render(
      <BrewPotionPanel
        kind="combine"
        deck={deck}
        onConfirm={onConfirm}
        onBack={() => {}}
        isProgressSavePending={() => true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select Health Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    const button = screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it.each(["strengthen", "combine"] as const)("retains its accepted %s preview while saving", (kind) => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!];
    const brewed = kind === "strengthen" ? strengthenPotion(deck[0]!)! : tryCreateMixedPotion(deck[0], deck[1])!;
    const onConfirm = vi.fn(() => brewed);
    const p = { kind, deck, onConfirm, onBack: () => {}, price: 10, gold: 10 };
    const { rerender } = render(<BrewPotionPanel {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Health Potion" }));
    if (kind === "combine") fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    const action = `${kind === "strengthen" ? "Distill" : "Mix"} · 10 Gold`;
    fireEvent.click(screen.getByRole("button", { name: action }));
    rerender(<BrewPotionPanel {...p} deck={[brewed]} gold={0} isProgressSavePending={() => true} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Not enough Gold/)).toBeNull();
    expect(screen.getByRole("button", { name: `Inspect brew result: ${brewed.title}` })).toBeTruthy();
    if (kind === "strengthen") {
      expect(screen.getByRole("button", { name: "Original: Health Potion" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Select Health Potion" })).toBeNull();
      const choose = screen.getByRole("button", { name: "Choose Another Potion" }) as HTMLButtonElement;
      expect(choose.disabled).toBe(true);
    }
    expect((screen.getByRole("button", { name: action }) as HTMLButtonElement).disabled).toBe(true);
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(
      kind === "strengthen" ? { kind, index: 0 } : { kind, indices: [0, 1] },
    );
  });
});
