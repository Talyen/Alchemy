import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransmutationScreen } from "@/features/alchemy/run-loop/screens/transmutation-screen";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { cardById, type BattleCard } from "@/lib/game-data";
import { StrictMode } from "react";
import { playUISound } from "@/lib/audio";
vi.mock("@/lib/audio", () => ({ playUISound: vi.fn() }));
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
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function createProps() {
  return {
    runDeck: [cardById.slash!, { ...cardById["health-potion"]!, brewed: true }],
    visit: { ...emptyAlchemyVisit(), offers: [cardById.fireball!, cardById.slash!, cardById.wish!] },
    onExchange: vi.fn<(source: number, offer: number) => BattleCard | null>(() => null),
    onContinue: vi.fn(),
  };
}
function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}
function expectDisabled(name: string) {
  expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
}

describe("Transmutation steps", () => {
  it("locks in the source immediately and exchanges and advances exactly once on replacement selection", () => {
    const props = createProps();
    props.onExchange.mockReturnValue(props.visit.offers[0]!);
    const { rerender } = render(<TransmutationScreen {...props} />);
    expect(screen.getByRole("heading", { name: "Choose a Card" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fireball" })).toBeNull();
    expectDisabled("Health Potion");
    click("Health Potion");
    expect(screen.getByRole("heading", { name: "Choose a Card" })).toBeTruthy();
    click("Slash");
    expect(props.onExchange).not.toHaveBeenCalled();
    expect(props.onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Your card is transmuted into..." })).toBeTruthy();
    expectDisabled("Slash");
    click("Slash");
    expect(props.onExchange).not.toHaveBeenCalled();
    click("Fireball");
    expect(props.onExchange).toHaveBeenCalledExactlyOnceWith(0, 0);
    expect(props.onContinue).toHaveBeenCalledOnce();
    expect(vi.mocked(playUISound).mock.calls).toEqual([["transmuteSelect"], ["transmuteSelect"]]);
    click("Wish");
    expect(props.onExchange).toHaveBeenCalledOnce();
    rerender(
      <TransmutationScreen
        {...props}
        runDeck={[props.visit.offers[0]!, props.runDeck[1]!]}
        visit={{ ...props.visit, completed: true, original: props.runDeck[0]!, result: props.visit.offers[0]! }}
      />,
    );
    expect(props.onContinue).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps a rejected exchange on the replacement step so another offer can be chosen", () => {
    const props = createProps();
    render(<TransmutationScreen {...props} />);
    click("Slash");
    click("Wish");
    expect(props.onExchange).toHaveBeenCalledExactlyOnceWith(0, 2);
    expect(props.onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("no longer available");
    expect(screen.getByRole("heading", { name: "Your card is transmuted into..." })).toBeTruthy();
    props.onExchange.mockReturnValue(props.visit.offers[0]!);
    click("Fireball");
    expect(props.onExchange).toHaveBeenLastCalledWith(0, 0);
    expect(props.onContinue).toHaveBeenCalledOnce();
  });

  it("waits for local acknowledgement before continuing an accepted exchange and ignores it after leaving", () => {
    const props = createProps();
    const pending: Array<() => void> = [];
    props.onExchange.mockReturnValue(props.visit.offers[0]!);
    const afterProgressSaved = (feedback: () => void) => {
      pending.push(feedback);
    };
    const { unmount } = render(<TransmutationScreen {...props} afterProgressSaved={afterProgressSaved} />);
    click("Slash");
    click("Fireball");
    expect(props.onExchange).toHaveBeenCalledOnce();
    expect(props.onContinue).not.toHaveBeenCalled();
    unmount();
    for (const feedback of pending) feedback();
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it("replayed completion effects advance once after a covering save", () => {
    const props = createProps();
    const pending: Array<() => void> = [];
    render(
      <StrictMode>
        <TransmutationScreen
          {...props}
          visit={{ ...props.visit, completed: true }}
          afterProgressSaved={(feedback) => {
            pending.push(feedback);
          }}
        />
      </StrictMode>,
    );
    expect(props.onContinue).not.toHaveBeenCalled();
    for (const feedback of pending) feedback();
    expect(props.onContinue).toHaveBeenCalledOnce();
  });

  it("requires a fresh source after a live deck reorder rather than exchanging the wrong card", () => {
    const props = createProps();
    const { rerender } = render(<TransmutationScreen {...props} />);
    click("Slash");
    rerender(<TransmutationScreen {...props} runDeck={[props.runDeck[1]!, props.runDeck[0]!]} />);
    expect(screen.getByRole("heading", { name: "Choose a Card" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("deck changed");
    expect(screen.queryByRole("button", { name: "Fireball" })).toBeNull();
    expect(props.onExchange).not.toHaveBeenCalled();
    click("Slash");
    click("Fireball");
    expect(props.onExchange).toHaveBeenCalledExactlyOnceWith(1, 0);
  });

  it("advances a completed revisit once even when effects replay", () => {
    const props = createProps();
    render(
      <StrictMode>
        <TransmutationScreen {...props} visit={{ ...props.visit, completed: true }} />
      </StrictMode>,
    );
    expect(props.onContinue).toHaveBeenCalledOnce();
    expect(props.onExchange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    {
      name: "no eligible sources",
      runDeck: [{ ...cardById["health-potion"]!, brewed: true }],
      offers: [cardById.fireball!],
    },
    { name: "only identical replacements", runDeck: [cardById.slash!], offers: [cardById.slash!] },
    { name: "no offers", runDeck: [cardById.slash!], offers: [] },
  ])("advances an initialized visit with $name instead of trapping the player", ({ runDeck, offers }) => {
    const props = createProps();
    render(<TransmutationScreen {...props} runDeck={runDeck} visit={{ ...props.visit, offers }} />);
    expect(props.onContinue).toHaveBeenCalledOnce();
    expect(props.onExchange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
