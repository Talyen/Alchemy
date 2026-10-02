import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBattlePlayback } from "@/app/screen-routes/use-battle-playback";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { resetBattlePresentationAndRun } from "../features/alchemy/run-loop/battle/battle-test-reset";
import { AUTO_END_TURN_DELAY_MS } from "@/lib/game-constants";
import { makeTestBattleState } from "../fixtures/battle";
import { cardById } from "@/lib/game-data";
import { makeEmptyHandBattle } from "../features/alchemy/run-loop/battle/open-battle-fixture";

function renderPlayback(overrides: Partial<Parameters<typeof useBattlePlayback>[0]> = {}) {
  return renderHook(
    (props: Partial<Parameters<typeof useBattlePlayback>[0]>) =>
      useBattlePlayback({
        screen: "battle",
        battleState: makeTestBattleState(),
        hasActiveBattle: true,
        gameMenuOpen: false,
        isAutoplayEnabled: false,
        handleEndTurn: vi.fn(),
        handleAutoplayCard: vi.fn(() => false),
        handleAutoplayWish: vi.fn(() => false),
        isCardPlayInProgress: () => false,
        ...overrides,
        ...props,
      }),
    { initialProps: overrides },
  );
}

describe("useBattlePlayback", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    resetBattlePresentationAndRun();
  });

  it("binds playback handlers on mount and unbinds on unmount", () => {
    const bindPlayback = vi.fn();
    const { unmount } = renderPlayback({ bindPlayback });

    expect(bindPlayback).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleAutoEndTurn: expect.any(Function),
        clearAutoEndTurn: expect.any(Function),
      }),
    );

    unmount();
    expect(bindPlayback).toHaveBeenLastCalledWith(null);
  });

  it("schedules auto-end when autoplay is enabled with an empty hand", () => {
    vi.useFakeTimers();
    const handleEndTurn = vi.fn();
    const { rerender } = renderPlayback({
      handleEndTurn,
      battleState: makeEmptyHandBattle().battleState,
      isAutoplayEnabled: false,
    });

    rerender({ isAutoplayEnabled: true });
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY_MS);
    });

    expect(handleEndTurn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("ends an autoplay turn containing only lethal cards, preserving manual choice when autoplay stops", () => {
    vi.useFakeTimers();
    useSettingsStore.setState({ autoEndTurn: true });
    const handleEndTurn = vi.fn();
    const handleAutoplayCard = vi.fn(() => false);
    const { rerender, unmount } = renderPlayback({
      handleEndTurn,
      handleAutoplayCard,
      battleState: makeTestBattleState({
        hand: [cardById["blood-offering"]!],
        playerHealth: 1,
        deathsDoorUsed: true,
      }),
      isAutoplayEnabled: true,
    });
    act(() => vi.advanceTimersByTime(AUTO_END_TURN_DELAY_MS));
    expect(handleAutoplayCard).not.toHaveBeenCalled();
    expect(handleEndTurn).toHaveBeenCalledOnce();

    handleEndTurn.mockClear();
    rerender({ isAutoplayEnabled: false });
    act(() => vi.advanceTimersByTime(AUTO_END_TURN_DELAY_MS * 2));
    expect(handleEndTurn).not.toHaveBeenCalled();
    unmount();
    vi.useRealTimers();
  });

  it("schedules auto-end when the settings toggle turns on mid-turn", () => {
    vi.useFakeTimers();
    useSettingsStore.setState({ autoEndTurn: false });
    const handleEndTurn = vi.fn();
    renderPlayback({
      handleEndTurn,
      battleState: makeEmptyHandBattle().battleState,
    });

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY_MS + 100);
    });
    expect(handleEndTurn).not.toHaveBeenCalled();

    act(() => {
      useSettingsStore.setState({ autoEndTurn: true });
    });
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY_MS);
    });

    expect(handleEndTurn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
