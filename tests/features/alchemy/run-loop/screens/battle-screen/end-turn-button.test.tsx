import "../../../../../helpers/mock-audio";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BattleEndTurnButton,
  type BattleEndTurnButtonProps,
} from "@/features/alchemy/run-loop/screens/battle-screen/end-turn-button";
import { battlePresentation } from "@/app/battle-presentation";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../../helpers/artwork-test";
import { makeTestBattleState, makeTestCard } from "../../../../../fixtures/battle";

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
installReadyArtworkForTests();
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 100, 40),
  ] as unknown as DOMRectList);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  useUiStore.getState().setCardInspection(null);
  useUiStore.getState().setEnemyInspectionOpen(false);
});
afterEach(() => {
  cleanup();
  battlePresentation.getState().resetPresentation();
  resetEscapeStackForTests();
  vi.restoreAllMocks();
  if (scrollIntoViewDescriptor)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

function setup(overrides: Partial<BattleEndTurnButtonProps> = {}) {
  const props: BattleEndTurnButtonProps = {
    battleState: makeTestBattleState({ hand: [makeTestCard({ cost: 1 })], mana: 2 }),
    hasActiveBattle: true,
    screen: "battle",
    blocked: false,
    presentation: battlePresentation,
    buttonRef: createRef<HTMLButtonElement>(),
    isCardPlayInProgress: () => false,
    subscribePlayback: () => () => {},
    isProgressSavePending: () => false,
    subscribeProgressSave: () => () => {},
    onEndTurn: vi.fn(),
    ...overrides,
  };
  const view = render(<BattleEndTurnButton {...props} />);
  return { ...view, props, button: props.buttonRef.current! };
}
async function openConfirmation(button: HTMLButtonElement) {
  fireEvent.click(button);
  await waitForArtwork();
  return within(screen.getByRole("dialog", { name: "End turn?" }));
}

describe("toolbar End Turn", () => {
  it("enables End Turn when opening playback completes without another presentation update", () => {
    const playback = new PlaybackLifetime();
    playback.beginOpening();
    const { button } = setup({
      isCardPlayInProgress: () => playback.cardPlayInProgress,
      subscribePlayback: playback.subscribe,
    });
    expect(button.disabled).toBe(true);
    act(() => playback.completeAction(playback.id));
    expect(button.disabled).toBe(false);
    act(() => playback.beginAction());
    expect(button.disabled).toBe(true);
    act(() => playback.completeAction(playback.id));
    expect(button.disabled).toBe(false);
  });

  it.each([true, false])(
    "requires confirmation with playable cards = %s and consumes repeated activation",
    async (playable) => {
      const { props, button } = setup(playable ? {} : { battleState: makeTestBattleState({ hand: [], mana: 0 }) });
      const dialog = await openConfirmation(button);
      expect(props.onEndTurn).not.toHaveBeenCalled();
      expect(battlePresentation.getState().endTurnConfirmationOpen).toBe(true);
      const confirm = dialog.getByRole("button", { name: "End Turn" });
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      expect(props.onEndTurn).toHaveBeenCalledTimes(1);
      expect(props.onEndTurn).toHaveBeenCalledWith(props.battleState);
      expect(battlePresentation.getState().endTurnConfirmationOpen).toBe(false);
    },
  );

  it.each(["Cancel", "Escape", "backdrop"])("%s cancels and returns focus without committing", async (method) => {
    const { props, button } = setup();
    button.focus();
    const dialog = await openConfirmation(button);
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    if (method === "Cancel") fireEvent.click(cancel);
    else if (method === "Escape") fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    else fireEvent.click(screen.getByTestId("confirmation-dialog").closest("[data-modal-content]")!);
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(props.onEndTurn).not.toHaveBeenCalled();
    expect(battlePresentation.getState().endTurnConfirmationOpen).toBe(false);
  });

  it.each(["snapshot", "navigation", "transfer", "save", "inspection", "reset", "unmount"])(
    "invalidates pending confirmation after %s",
    async (change) => {
      let savePending = false;
      let notifySave = () => {};
      const { props, button, rerender, unmount } = setup({
        isProgressSavePending: () => savePending,
        subscribeProgressSave: (listener) => {
          notifySave = listener;
          return () => {
            notifySave = () => {};
          };
        },
      });
      const dialog = await openConfirmation(button);
      const confirm = dialog.getByRole("button", { name: "End Turn" });
      if (change === "snapshot")
        rerender(<BattleEndTurnButton {...props} battleState={{ ...props.battleState, mana: 0 }} />);
      if (change === "navigation") rerender(<BattleEndTurnButton {...props} screen="menu" />);
      if (change === "transfer") act(() => battlePresentation.getState().setCardTransferInProgress(true));
      if (change === "save")
        act(() => {
          savePending = true;
          notifySave();
        });
      if (change === "reset") act(() => battlePresentation.getState().resetPresentation());
      if (change === "inspection") act(() => useUiStore.getState().setEnemyInspectionOpen(true));
      if (change === "unmount") unmount();
      fireEvent.click(confirm);
      expect(props.onEndTurn).not.toHaveBeenCalled();
      expect(battlePresentation.getState().endTurnConfirmationOpen).toBe(false);
    },
  );

  it.each(["transfer", "playback", "save", "wish", "completed", "inactive", "menu", "hidden"])(
    "blocks new confirmation during %s",
    (reason) => {
      if (reason === "transfer") battlePresentation.getState().setCardTransferInProgress(true);
      const state = makeTestBattleState();
      if (reason === "hidden") {
        state.hand = [makeTestCard({ uid: 1, id: "slash" })];
        battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1"]);
      }
      const { button, props } = setup({
        battleState:
          reason === "wish"
            ? { ...state, wishOptions: [makeTestCard()] }
            : reason === "completed"
              ? { ...state, enemyHealth: 0 }
              : state,
        hasActiveBattle: reason !== "inactive",
        blocked: reason === "menu",
        isCardPlayInProgress: () => reason === "playback",
        isProgressSavePending: () => reason === "save",
      });
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(props.onEndTurn).not.toHaveBeenCalled();
    },
  );

  it("renders an icon with an End Turn tooltip on hover and focus", async () => {
    const { button } = setup();
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
    fireEvent.mouseEnter(button);
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("End Turn"));
    fireEvent.mouseLeave(button);
    fireEvent.focus(button);
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("End Turn"));
  });
});
