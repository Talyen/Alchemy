// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { ROUTE_SCREENS } from "@/lib/routing";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useScreenTransitions.transition", () => {
  it("applies immediate setScreen transitions", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));
    const onCommit = vi.fn();

    result.current.transition(CONSTANTS.SCREENS.GAME_OVER, { immediate: true, onCommit });

    expect(setScreen).toHaveBeenCalledWith(CONSTANTS.SCREENS.GAME_OVER);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("routes delayed transitions through setScreen", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.transition(CONSTANTS.SCREENS.REWARDS, { delayMs: 250 });
    expect(setScreen).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(setScreen).toHaveBeenCalledWith(CONSTANTS.SCREENS.REWARDS);
  });

  it("skips delayed transitions when guard returns false at apply time", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));
    let hasActiveRun = true;

    result.current.transition(CONSTANTS.SCREENS.REWARDS, {
      delayMs: 250,
      guard: () => hasActiveRun,
    });
    vi.advanceTimersByTime(250);
    expect(setScreen).toHaveBeenCalledWith(CONSTANTS.SCREENS.REWARDS);

    setScreen.mockClear();
    hasActiveRun = false;
    result.current.transition(CONSTANTS.SCREENS.REWARDS, {
      delayMs: 250,
      guard: () => hasActiveRun,
    });
    vi.advanceTimersByTime(250);
    expect(setScreen).not.toHaveBeenCalled();
  });
});
