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
import { cardById, keywordDefinitions, type BattleCard } from "@/lib/game-data";
import { getTransmutationVariants, getTransmutationOffers } from "@/lib/alchemist/transmutation";
import { defaultGameSession } from "@/app/application-session";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
vi.mock("@/lib/audio", () => ({ playUISound: vi.fn() }));
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => ({
  SelectableCard: ({ card, onSelect, disabled }: { card: BattleCard; onSelect: () => void; disabled?: boolean }) => (
    <button disabled={disabled} onClick={onSelect}>
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
  return (
    <TransmutationScreen
      {...useTransmutationScreenData()}
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
function visit() {
  const activity = readRunSession(defaultGameSession).activity;
  if (activity.kind !== "transmutation") throw new Error("wrong activity");
  return activity.data;
}
function chooseAlteration() {
  click("Slash");
  const offers = getTransmutationOffers(visit());
  const preview = offers.at(-1)!;
  click(`Choose ${keywordDefinitions[preview.transmuted!].label}`);
  return preview;
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
  it("skips a saved Companion choice when its summon has left the deck", () => {
    const source = cardById.slash!;
    const deck = [source, cardById["wolf-companion"]!];
    const variant = getTransmutationVariants(source, "companion", deck)[0]!;
    setRunProgress({ runDeck: [source] });
    setRunSession({
      activity: {
        kind: "transmutation",
        data: {
          ...visit(),
          transmutation: {
            choices: [{ keyword: "companion", alterations: [{ ...variant, sourceIndex: 0, source }] }],
            source: null,
            sourceIndex: null,
            keyword: null,
            offerIndex: null,
          },
        },
      },
    });
    expect(selectTransmutation({ kind: "source", index: 0, card: source }, defaultGameSession)).toBe(false);
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Slash" })).toBeNull();
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("selects the next fixed offer when only the Companion alteration becomes unavailable", () => {
    const source = cardById.slash!;
    const deck = [source, cardById["wolf-companion"]!];
    setRunProgress({ runDeck: [source] });
    setRunSession({
      activity: {
        kind: "transmutation",
        data: {
          ...visit(),
          transmutation: {
            choices: (["companion", "burn"] as const).map((keyword) => ({
              keyword,
              alterations: [
                {
                  ...getTransmutationVariants(source, keyword, deck)[0]!,
                  sourceIndex: 0,
                  source,
                },
              ],
            })),
            source: null,
            sourceIndex: null,
            keyword: null,
            offerIndex: null,
          },
        },
      },
    });
    render(<Harness />);
    click("Slash");
    expect(visit().transmutation).toMatchObject({ keyword: "burn", offerIndex: 1 });
    expect((screen.getByRole("button", { name: "Choose Companion" }) as HTMLButtonElement).disabled).toBe(true);
    click("Transmute");
    expect(readActiveRun(defaultGameSession).runDeck[0]?.transmuted).toBe("burn");
    expect(onExchange).toHaveBeenCalledExactlyOnceWith(0, 1);
  });

  it("shows keyword buttons above original and preview, keeps values, and commits only through Transmute", () => {
    const before = readActiveRun(defaultGameSession).runDeck;
    render(<Harness />);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect((screen.getByRole("button", { name: "Mixed Potion" }) as HTMLButtonElement).disabled).toBe(true);
    const preview = chooseAlteration();
    const choices = screen.getByRole("group", { name: "Alterations" });
    const comparison = screen.getByLabelText("Transmutation comparison");
    expect(choices.compareDocumentPosition(comparison) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Original: Slash" })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Preview: ${preview.title}` })).toBeTruthy();
    expect(screen.getByRole("button", { pressed: true }).textContent).toContain(
      keywordDefinitions[preview.transmuted!].label,
    );
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(before);
    expect(onExchange).not.toHaveBeenCalled();
    click("Transmute");
    expect(onExchange).toHaveBeenCalledExactlyOnceWith(0, getTransmutationOffers(visit()).length - 1);
    expect(readActiveRun(defaultGameSession).runDeck[0]).toEqual(preview);
    expect(onContinue).toHaveBeenCalledOnce();
    click("Transmute");
    expect(onExchange).toHaveBeenCalledOnce();
  });

  it("restores keyboard focus to the alteration controls when the source picker is replaced", () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    render(<Harness />);
    const source = screen.getByRole("button", { name: "Slash" });
    source.focus();
    fireEvent.keyDown(source, { key: "Enter" });
    fireEvent.click(source, { detail: 0 });
    expect(screen.getByRole("group", { name: "Alterations" }).contains(document.activeElement)).toBe(true);
  });

  it("blocks selection, commitment, and Leave when a save starts before the next render", () => {
    let pending = false;
    render(<Harness isProgressSavePending={() => pending} />);
    pending = true;
    click("Slash");
    expect(visit().transmutation!.source).toBeNull();
    click("Leave");
    expect(onContinue).not.toHaveBeenCalled();
    pending = false;
    chooseAlteration();
    const selected = visit();
    pending = true;
    click("Back");
    click("Transmute");
    expect(visit()).toEqual(selected);
    expect(onExchange).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("Back retains the fixed offers and preview without rerolling", () => {
    render(<Harness />);
    click("Slash");
    const before = visit();
    const rng = readActiveRun(defaultGameSession).rng;
    click("Back");
    click("Slash");
    expect(visit()).toEqual(before);
    expect(readActiveRun(defaultGameSession).rng).toEqual(rng);
    expect(onExchange).not.toHaveBeenCalled();
  });

  it("waits for save acknowledgement, locks controls, and ignores callbacks after unmount", () => {
    const pending: Array<() => void> = [];
    const { unmount } = render(<Harness afterProgressSaved={(callback) => pending.push(callback)} />);
    chooseAlteration();
    click("Transmute");
    expect(onExchange).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Transmute" }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    for (const callback of pending) callback();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("keeps rejected commitments on the preview and permits retry", () => {
    onExchange.mockReturnValueOnce(null);
    render(<Harness />);
    chooseAlteration();
    click("Transmute");
    expect(screen.getByRole("alert").textContent).toContain("no longer available");
    expect(onContinue).not.toHaveBeenCalled();
    click("Transmute");
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("rejects a stale deck and does not manufacture new offers when cards move", () => {
    render(<Harness />);
    chooseAlteration();
    const choices = visit().transmutation!.choices;
    act(() => setRunProgress({ runDeck: [cardById.frostbolt!, cardById.slash!] }));
    expect(visit().transmutation!.choices).toEqual(choices);
    expect(onExchange).not.toHaveBeenCalled();
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("continues a committed resume only once after a covering save, including StrictMode replay", () => {
    render(<Harness />);
    chooseAlteration();
    click("Transmute");
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
});
