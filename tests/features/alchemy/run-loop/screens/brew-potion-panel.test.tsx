import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrewPotionPanel } from "@/features/alchemy/run-loop/screens/brew-potion-panel";
import { cardById, type BattleCard } from "@/lib/game-data";
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
  it("opens Strengthen when the shop has only one eligible Potion", () => {
    render(
      <BrewPotionPanel deck={[cardById["health-potion"]!]} allowStrengthen onConfirm={() => null} onBack={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Strengthen", pressed: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select Health Potion" }));
    expect(screen.getByRole("button", { name: "Inspect brew result: Health Potion" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Brew" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("requires fresh source selection if the deck changes before confirmation", () => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!];
    const onConfirm = vi.fn(() => null);
    const onBack = vi.fn();
    const { rerender } = render(<BrewPotionPanel deck={deck} onConfirm={onConfirm} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Health Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    expect((screen.getByRole("button", { name: "Brew" }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<BrewPotionPanel deck={[deck[1]!, deck[0]!]} onConfirm={onConfirm} onBack={onBack} />);
    expect(screen.queryByRole("button", { name: "Inspect brew result: Mixed Potion" })).toBeNull();
    expect((screen.getByRole("button", { name: "Brew" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("deck changed");
    fireEvent.click(screen.getByRole("button", { name: "Brew" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
