import { initializeAlchemyVisitForTest as initializeAlchemyVisit } from "../../../../helpers/visit-initialization";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playUISound } from "@/lib/audio";
import { StrictMode } from "react";
import { TransmutationScreen } from "@/features/alchemy/run-loop/screens/transmutation-screen";
import { selectTransmutation, transmuteCard } from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { useRunScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
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
      {...useRunScreenData("transmutation")}
      onSelect={(command) => selectTransmutation(command, defaultGameSession)}
      onExchange={onExchange}
      onContinue={onContinue}
      afterProgressSaved={afterProgressSaved}
      isProgressSavePending={isProgressSavePending}
    />
  );
}
function tooltipFor(name: string) {
  const button = screen.getByRole("button", { name });
  return within(document.getElementById(button.getAttribute("aria-describedby")!)!);
}
function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}
function visit() {
  const activity = readRunSession(defaultGameSession).activity;
  if (activity.kind !== "transmutation") throw new Error("wrong activity");
  return activity.data;
}
async function waitFor(assertion: () => void) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await act(async () => vi.advanceTimersByTimeAsync(50));
    try {
      assertion();
      return;
    } catch (error) {
      if (attempt === 19) throw error;
    }
  }
}
async function previewReady() {
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "Transmute" }) as HTMLButtonElement).disabled).toBe(false),
  );
}
async function chooseAlteration() {
  click("Slash");
  const offers = getTransmutationOffers(visit());
  const preview = offers.at(-1)!;
  click(`Choose ${keywordDefinitions[preview.transmuted!].label}`);
  await previewReady();
  return preview;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
  resetAllTestStores();
  vi.clearAllMocks();
  setRunProgress({ characterId: "wizard", runDeck: [cardById.slash!, cardById.frostbolt!, cardById["mixed-potion"]!] });
  setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
  initializeAlchemyVisit("transmutation", defaultGameSession);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  localStorage.removeItem("alchemy-disable-animations");
});

describe("Transmutation flow", () => {
  it("selects the next fixed offer when only the Companion alteration becomes unavailable", async () => {
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
    expect(screen.queryByRole("button", { name: "Choose Companion" })).toBeNull();
    await previewReady();
    click("Transmute");
    expect(readActiveRun(defaultGameSession).runDeck[0]?.transmuted).toBe("burn");
    expect(onExchange).toHaveBeenCalledExactlyOnceWith(0, 1);
  });

  it("shows only the selected card's choices and preserves them after switching cards", () => {
    const choices = visit().transmutation!.choices;
    expect(choices.length).toBeGreaterThan(3);
    render(<Harness />);
    for (const title of ["Slash", "Frostbolt", "Slash"]) {
      click(title);
      const offers = getTransmutationOffers(visit());
      const buttons = within(screen.getByRole("group", { name: "Alterations" })).getAllByRole("button");
      expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
        offers.map((offer) => `Choose ${keywordDefinitions[offer.transmuted!].label}`),
      );
      expect(buttons).toHaveLength(3);
      expect(buttons.every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
      click("Back");
    }
    expect(visit().transmutation!.choices).toEqual(choices);
  });

  it("shows keyword buttons above original and preview, keeps values, and commits only through Transmute", async () => {
    const before = readActiveRun(defaultGameSession).runDeck;
    render(<Harness />);
    expect((screen.getByRole("button", { name: "Mixed Potion" }) as HTMLButtonElement).disabled).toBe(true);
    const preview = await chooseAlteration();
    expect(screen.getByRole("button", { name: "Original: Slash" })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Preview: ${preview.title}` })).toBeTruthy();
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(before);
    expect(onExchange).not.toHaveBeenCalled();
    click("Transmute");
    expect(onExchange).toHaveBeenCalledExactlyOnceWith(0, getTransmutationOffers(visit()).length - 1);
    expect(readActiveRun(defaultGameSession).runDeck[0]).toEqual(preview);
    expect(onContinue).not.toHaveBeenCalled();
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(screen.getByRole("button", { name: `Transmuted: ${preview.title}` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Transmute" })).toBeNull();
    expect(playUISound).toHaveBeenCalledWith("talentUnlock");
    click("Continue");
    click("Continue");
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onExchange).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "only commits the latest preview after rapid switching (animations disabled: %s)",
    async (disabled) => {
      if (disabled) localStorage.setItem("alchemy-disable-animations", "true");
      render(<Harness />);
      click("Slash");
      await previewReady();
      const before = readActiveRun(defaultGameSession).runDeck;
      const offers = getTransmutationOffers(visit());
      const first = offers[visit().transmutation!.offerIndex!]!;
      const last = offers.find((offer) => offer.transmuted !== first.transmuted)!;
      const choose = (card: BattleCard) => click(`Choose ${keywordDefinitions[card.transmuted!].label}`);
      choose(last);
      choose(first);
      choose(last);
      expect((screen.getByRole("button", { name: "Transmute" }) as HTMLButtonElement).disabled).toBe(true);
      click("Transmute");
      expect(onExchange).not.toHaveBeenCalled();
      expect(readActiveRun(defaultGameSession).runDeck).toEqual(before);
      await previewReady();
      expect(screen.getByRole("button", { name: `Preview: ${last.title}` })).toBeTruthy();
      click("Transmute");
      expect(readActiveRun(defaultGameSession).runDeck[0]).toEqual(last);
      expect(onExchange).toHaveBeenCalledExactlyOnceWith(0, offers.indexOf(last));
    },
  );

  it("reveals the saved result once after a retry and focuses Continue without granting twice", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    let saving = false;
    const pending: Array<() => void> = [];
    const afterSaved = (callback: () => void) => pending.push(callback);
    onExchange.mockImplementationOnce((source, offer) => {
      saving = true;
      return transmuteCard(source, offer, defaultGameSession);
    });
    const view = () => <Harness afterProgressSaved={afterSaved} isProgressSavePending={() => saving} />;
    const { rerender } = render(view());
    const preview = await chooseAlteration();
    vi.mocked(playUISound).mockClear();
    click("Transmute");
    click("Transmute");
    expect(onExchange).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Transmutation result")).toBeNull();
    expect(playUISound).not.toHaveBeenCalled();
    // A failed save keeps the same locked comparison until retry acknowledges it.
    rerender(view());
    expect((screen.getByRole("button", { name: "Transmute" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onContinue).not.toHaveBeenCalled();
    saving = false;
    act(() => {
      for (const callback of pending) {
        callback();
        callback();
      }
    });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" })));
    expect(screen.getByRole("button", { name: `Transmuted: ${preview.title}` })).toBeTruthy();
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("talentUnlock");
    const deck = readActiveRun(defaultGameSession).runDeck;
    saving = true;
    click("Continue");
    expect(onContinue).not.toHaveBeenCalled();
    saving = false;
    click("Continue");
    click("Continue");
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onExchange).toHaveBeenCalledOnce();
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(deck);
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

  it("blocks selection, commitment, and Leave when a save starts before the next render", async () => {
    let pending = false;
    render(<Harness isProgressSavePending={() => pending} />);
    pending = true;
    click("Slash");
    expect(visit().transmutation!.source).toBeNull();
    click("Leave");
    expect(onContinue).not.toHaveBeenCalled();
    pending = false;
    await chooseAlteration();
    const selected = visit();
    pending = true;
    click("Back");
    click("Transmute");
    expect(visit()).toEqual(selected);
    expect(onExchange).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("waits for save acknowledgement, locks controls, and ignores callbacks after unmount", async () => {
    const pending: Array<() => void> = [];
    const { unmount } = render(<Harness afterProgressSaved={(callback) => pending.push(callback)} />);
    await chooseAlteration();
    click("Transmute");
    expect(onExchange).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Transmute" }) as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(playUISound).mockClear();
    unmount();
    for (const callback of pending) callback();
    expect(onContinue).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("keeps rejected commitments on the preview and permits retry", async () => {
    onExchange.mockReturnValueOnce(null);
    render(<Harness />);
    await chooseAlteration();
    click("Transmute");
    expect(screen.getByRole("alert").textContent).toContain("no longer available");
    expect(onContinue).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalledWith("talentUnlock");
    click("Transmute");
    expect(onContinue).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("talentUnlock");
  });

  it("safely continues a completed visit missing its result after save acknowledgement", () => {
    setRunSession({ activity: { kind: "transmutation", data: { ...visit(), completed: true, result: null } } });
    const pending: Array<() => void> = [];
    render(
      <StrictMode>
        <Harness afterProgressSaved={(callback) => pending.push(callback)} />
      </StrictMode>,
    );
    expect(onContinue).not.toHaveBeenCalled();
    act(() => {
      for (const callback of pending) {
        callback();
        callback();
      }
    });
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onExchange).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("leaves a damaged visit with missing choices without regenerating gameplay", () => {
    setRunSession({
      activity: { kind: "transmutation", data: { offers: [], result: null, original: null, completed: false } },
    });
    const before = readActiveRun(defaultGameSession);
    render(<Harness />);
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onExchange).not.toHaveBeenCalled();
    expect(readActiveRun(defaultGameSession)).toEqual(before);
  });

  it("resumes the saved result silently and continues only on request, including StrictMode replay", async () => {
    render(<Harness />);
    await chooseAlteration();
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
    vi.mocked(playUISound).mockClear();
    expect(screen.queryByLabelText("Transmutation result")).toBeNull();
    act(() => {
      for (const callback of pending) callback();
    });
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(screen.getByRole("button", { name: `Transmuted: ${visit().result!.title}` })).toBeTruthy();
    act(() => screen.getByRole("button", { name: `Transmuted: ${visit().result!.title}` }).focus());
    expect(tooltipFor(`Transmuted: ${visit().result!.title}`).getAllByText("NEW").length).toBeGreaterThan(0);
    expect(playUISound).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
    click("Continue");
    click("Continue");
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onExchange).not.toHaveBeenCalled();
  });
});
