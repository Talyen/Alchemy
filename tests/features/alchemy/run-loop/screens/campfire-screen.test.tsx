import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampfireScreen } from "@/features/alchemy/run-loop/screens/campfire-screen";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { cardById } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => ({
  SelectableCard: ({ card, onSelect }: { card: { title: string }; onSelect: () => void }) => (
    <button onClick={onSelect}>{card.title}</button>
  ),
}));
vi.mock(
  "@/features/alchemy/shared/ui/cards/card-selection-grid",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
afterEach(cleanup);
describe("Campfire Rest or Brew", () => {
  installDisabledAnimationsForTests();
  it("allows inspecting a brew and returning to Rest without spending the visit", () => {
    const onRest = vi.fn(() => true);
    const onBrew = vi.fn(() => null);
    const onContinue = vi.fn();
    render(
      <CampfireScreen
        playerHealth={20}
        maxHealth={100}
        healFraction={0.3}
        runDeck={[]}
        visit={{ ...emptyAlchemyVisit(), offers: [cardById["health-potion"]!] }}
        potency={0}
        onRest={onRest}
        onBrew={onBrew}
        onContinue={onContinue}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Brew Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Health Potion" }));
    expect(screen.getByText("Added to your run deck. Available each battle.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBrew).not.toHaveBeenCalled();
    expect(onRest).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Rest · Recover 30 Health" })).toBeTruthy();
  });
  it("shows zero Rest healing at full Health and acknowledges a restored completed brew", () => {
    const props = {
      playerHealth: 100,
      maxHealth: 100,
      healFraction: 0.3,
      runDeck: [],
      potency: 0,
      onRest: vi.fn(() => true),
      onBrew: vi.fn(() => null),
      onContinue: vi.fn(),
    };
    const { rerender } = render(<CampfireScreen {...props} visit={emptyAlchemyVisit()} />);
    expect(screen.getByText("Health is full. Rest restores no Health.")).toBeTruthy();
    rerender(
      <CampfireScreen
        {...props}
        visit={{ ...emptyAlchemyVisit(), completed: true, result: cardById["health-potion"]! }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Brew Potion" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Potion brewed");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(props.onContinue).toHaveBeenCalledOnce();
  });
});
