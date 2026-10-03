import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransmutationScreen } from "@/features/alchemy/run-loop/screens/transmutation-screen";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { cardById } from "@/lib/game-data";
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => ({
  SelectableCard: ({
    card,
    onSelect,
    disabled,
  }: {
    card: { title: string };
    onSelect: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onSelect}>
      {card.title}
    </button>
  ),
}));
vi.mock(
  "@/features/alchemy/shared/ui/cards/card-selection-grid",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
afterEach(cleanup);
describe("Transmutation confirmation", () => {
  it("shows source loss and exact result before committing, and disables brewed sources", () => {
    const onExchange = vi.fn(() => null);
    const props = {
      runDeck: [cardById.slash!, { ...cardById["health-potion"]!, brewed: true }],
      visit: { ...emptyAlchemyVisit(), offers: [cardById.fireball!, cardById.block!, cardById.wish!] },
      onExchange,
      onContinue: vi.fn(),
    };
    render(<TransmutationScreen {...props} />);
    expect((screen.getByRole("button", { name: "Health Potion" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Slash" }));
    fireEvent.click(screen.getByRole("button", { name: "Fireball" }));
    expect(onExchange).not.toHaveBeenCalled();
    expect(screen.getByText("Slash leaves your deck. Fireball replaces it.")).toBeTruthy();
    const preview = within(screen.getByRole("region", { name: "Exchange preview" }));
    expect(preview.getByRole("button", { name: "Inspect surrendered card: Slash" })).toBeTruthy();
    expect(preview.getByRole("button", { name: "Inspect replacement: Fireball" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Transmute" }));
    expect(onExchange).toHaveBeenCalledExactlyOnceWith(0, 0);
    expect(screen.getByRole("alert").textContent).toContain("no longer available");
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(props.onContinue).toHaveBeenCalledOnce();
  });
  it("does not exchange a different source after a live deck reorder", () => {
    const onExchange = vi.fn(() => null);
    const props = {
      runDeck: [cardById.slash!, cardById["health-potion"]!],
      visit: { ...emptyAlchemyVisit(), offers: [cardById.fireball!, cardById.block!, cardById.wish!] },
      onExchange,
      onContinue: vi.fn(),
    };
    const { rerender } = render(<TransmutationScreen {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Slash" }));
    fireEvent.click(screen.getByRole("button", { name: "Fireball" }));
    rerender(<TransmutationScreen {...props} runDeck={[props.runDeck[1]!, props.runDeck[0]!]} />);
    expect(screen.queryByRole("region", { name: "Exchange preview" })).toBeNull();
    expect((screen.getByRole("button", { name: "Transmute" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("deck changed");
    fireEvent.click(screen.getByRole("button", { name: "Transmute" }));
    expect(onExchange).not.toHaveBeenCalled();
  });
});
