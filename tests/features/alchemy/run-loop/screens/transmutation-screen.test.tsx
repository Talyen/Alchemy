import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { TransmutationScreen } from "@/features/alchemy/run-loop/screens/transmutation-screen";
import {
  initializeAlchemyVisit,
  selectTransmutation,
  transmuteCard,
} from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { useTransmutationScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { cardById, type BattleCard } from "@/lib/game-data";
import { defaultGameSession } from "@/app/application-session";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
vi.mock("@/lib/audio", () => ({ playUISound: vi.fn() }));
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => ({
  SelectableCard: ({
    card,
    onSelect,
    disabled,
    isSelected,
  }: {
    card: BattleCard;
    onSelect: () => void;
    disabled?: boolean;
    isSelected: boolean;
  }) => (
    <button disabled={disabled} aria-pressed={isSelected} onClick={onSelect}>
      {card.title}
    </button>
  ),
}));
vi.mock(
  "@/features/alchemy/shared/ui/cards/card-selection-grid",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
const onContinue = vi.fn();
const onExchange = vi.fn((source: number, offer: number) => transmuteCard(source, offer, defaultGameSession));
function Harness({
  afterProgressSaved,
  isProgressSavePending,
}: {
  afterProgressSaved?: (callback: () => void) => void;
  isProgressSavePending?: () => boolean;
}) {
  const data = useTransmutationScreenData();
  return (
    <TransmutationScreen
      {...data}
      onSelect={(command) => selectTransmutation(command, defaultGameSession)}
      onExchange={onExchange}
      onContinue={onContinue}
      afterProgressSaved={afterProgressSaved}
      isProgressSavePending={isProgressSavePending}
    />
  );
}
function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}
function chooseOutcome() {
  click("Slash");
  click("Choose Burn");
  const activity = readRunSession(defaultGameSession).activity;
  if (activity.kind !== "transmutation") throw new Error("wrong activity");
  const source = activity.data.transmutation!.source!;
  const outcome = activity.data
    .transmutation!.choices.find((choice) => choice.keyword === "burn")!
    .candidates.find((card) => card.id !== source.id)!;
  click(outcome.title);
  return outcome;
}
beforeEach(() => {
  resetAllTestStores();
  vi.clearAllMocks();
  setRunProgress({ characterId: "wizard", runDeck: [cardById.slash!, cardById.frostbolt!, cardById["mixed-potion"]!] });
  setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
  initializeAlchemyVisit("transmutation", defaultGameSession);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("Transmutation flow", () => {
  it("keeps keyboard focus on the current step when a source or keyword replaces the focused control", () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    render(<Harness />);
    const source = screen.getByRole("button", { name: "Slash" });
    source.focus();
    fireEvent.keyDown(source, { key: "Enter" });
    fireEvent.click(source, { detail: 0 });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Choose Mana" }));
    const keyword = screen.getByRole("button", { name: "Choose Burn" });
    keyword.focus();
    fireEvent.keyDown(keyword, { key: "Enter" });
    fireEvent.click(keyword, { detail: 0 });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Inspect Burn keyword" }));
  });

  it("shows only keyword chips after choosing a source and commits only through Continue", () => {
    const before = readActiveRun(defaultGameSession).runDeck;
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Transform a Card" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Mixed Potion" }) as HTMLButtonElement).disabled).toBe(true);
    click("Slash");
    expect(screen.getByRole("button", { name: "Choose Mana" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose Burn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose Freeze" })).toBeTruthy();
    for (const text of [/affinity/i, /Transforming/i, /Choose a Keyword/i]) expect(screen.queryByText(text)).toBeNull();
    click("Choose Burn");
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    const choices = screen.getAllByRole("button", { pressed: false });
    expect(choices).toHaveLength(3);
    fireEvent.click(choices[0]!);
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(before);
    expect(onExchange).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Choose an Outcome" })).toBeTruthy();
    click("Continue");
    expect(onExchange).toHaveBeenCalledExactlyOnceWith(0, 0);
    expect(onContinue).toHaveBeenCalledOnce();
    expect(readActiveRun(defaultGameSession).runDeck[0]?.id).not.toBe("slash");
    expect(screen.getByRole("heading", { name: "Choose an Outcome" })).toBeTruthy();
    click("Continue");
    expect(onExchange).toHaveBeenCalledOnce();
  });

  it("Back preserves fixed outcomes and clears only the later selection", () => {
    render(<Harness />);
    chooseOutcome();
    const initial = readRunSession(defaultGameSession).activity;
    click("Back");
    click("Choose Burn");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(3);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    const activity = readRunSession(defaultGameSession).activity;
    if (initial.kind !== "transmutation" || activity.kind !== "transmutation") throw new Error("wrong visit");
    expect(activity.data.transmutation!.choices).toEqual(initial.data.transmutation!.choices);
    click("Back");
    click("Back");
    expect(screen.getByRole("heading", { name: "Transform a Card" })).toBeTruthy();
    expect(onExchange).not.toHaveBeenCalled();
  });

  it("waits for save acknowledgement, locks choices, and ignores callbacks after unmount", () => {
    const pending: Array<() => void> = [];
    const { unmount } = render(<Harness afterProgressSaved={(callback) => pending.push(callback)} />);
    chooseOutcome();
    click("Continue");
    expect(onExchange).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    for (const callback of pending) callback();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("keeps rejected commitments on the outcome choices and allows retry", () => {
    onExchange.mockReturnValueOnce(null);
    render(<Harness />);
    chooseOutcome();
    click("Continue");
    expect(screen.getByRole("alert").textContent).toContain("no longer available");
    expect(onContinue).not.toHaveBeenCalled();
    click("Continue");
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("requires a new source after a deck reorder", () => {
    render(<Harness />);
    chooseOutcome();
    act(() => setRunProgress({ runDeck: [cardById.frostbolt!, cardById.slash!] }));
    expect(screen.getByRole("heading", { name: "Transform a Card" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("deck changed");
    chooseOutcome();
    click("Continue");
    expect(onExchange).toHaveBeenCalledExactlyOnceWith(1, 0);
  });

  it("continues a committed revisit once after a covering save even when effects replay", () => {
    render(<Harness />);
    chooseOutcome();
    click("Continue");
    cleanup();
    onContinue.mockClear();
    onExchange.mockClear();
    const pending: Array<() => void> = [];
    render(
      <StrictMode>
        <Harness afterProgressSaved={(callback) => pending.push(callback)} />
      </StrictMode>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    for (const callback of pending) callback();
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onExchange).not.toHaveBeenCalled();
  });

  it("advances an initialized visit with no eligible source instead of trapping the player", () => {
    setRunProgress({ runDeck: [cardById["mixed-potion"]!] });
    render(<Harness />);
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onExchange).not.toHaveBeenCalled();
  });
});
