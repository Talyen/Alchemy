import "../../../../../helpers/mock-audio";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BattleEndTurnButton,
  type BattleEndTurnButtonProps,
} from "@/features/alchemy/run-loop/screens/battle-screen/end-turn-button";
import { battlePresentation } from "@/app/battle-presentation";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { installReadyArtworkForTests } from "../../../../../helpers/artwork-test";
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
describe("corner End Turn", () => {
  it("enables End Turn when opening playback completes without another presentation update", () => {
    const playback = new PlaybackLifetime();
    playback.beginOpening(playback.id);
    const { button } = setup({
      isCardPlayInProgress: () => playback.cardPlayInProgress,
      subscribePlayback: playback.subscribe,
    });
    expect(button.disabled).toBe(true);
    act(() => playback.completeAction(playback.id));
    expect(button.disabled).toBe(false);
    act(() => playback.beginAction(playback.id));
    expect(button.disabled).toBe(true);
    act(() => playback.completeAction(playback.id));
    expect(button.disabled).toBe(false);
  });

  it.each([true, false])("ends immediately with playable cards = %s", (playable) => {
    const { props, button } = setup(playable ? {} : { battleState: makeTestBattleState({ hand: [], mana: 0 }) });
    fireEvent.click(button);
    expect(props.onEndTurn).toHaveBeenCalledExactlyOnceWith(props.battleState);
    expect(button.textContent).toBe("End Turn");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["transfer", "playback", "save", "wish", "completed", "inactive", "menu", "hidden"])(
    "blocks direct turn ending during %s",
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

  it("tracks opening-draw presentation reactively without another store update", () => {
    const { button, props } = setup();
    expect(button.disabled).toBe(false);
    act(() => battlePresentation.getState().setOpeningDrawPending(true));
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(props.onEndTurn).not.toHaveBeenCalled();
    act(() => battlePresentation.getState().setOpeningDrawPending(false));
    expect(button.disabled).toBe(false);
  });
});
