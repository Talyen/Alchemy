// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import { resetRunNavigationSlice } from "../../../helpers/run-domain-store-test";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";

beforeEach(() => {
  vi.useFakeTimers();
  resetRunNavigationSlice();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useScreenTransitions.transition", () => {
  it("applies immediate setScreen transitions", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));
    const onCommit = vi.fn();

    result.current.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true, onCommit });

    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_OVER);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("routes delayed transitions through setScreen", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.transition(ROUTE_SCREENS.REWARDS, { delayMs: 250 });
    expect(setScreen).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.REWARDS);
  });

  it("skips delayed transitions when guard returns false at apply time", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));
    let hasActiveRun = true;

    result.current.transition(ROUTE_SCREENS.REWARDS, {
      delayMs: 250,
      guard: () => hasActiveRun,
    });
    vi.advanceTimersByTime(250);
    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.REWARDS);

    setScreen.mockClear();
    hasActiveRun = false;
    result.current.transition(ROUTE_SCREENS.REWARDS, {
      delayMs: 250,
      guard: () => hasActiveRun,
    });
    vi.advanceTimersByTime(250);
    expect(setScreen).not.toHaveBeenCalled();
  });
});

describe("useScreenTransitions navigation", () => {
  it("navigateTo updates screen after the navigation delay", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.MENU, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.GAME_MODE_SELECT);
      vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    });

    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_MODE_SELECT);
  });

  it("commitPendingTransition runs deferred screen commit callbacks", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.MENU, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.MENU, onCommit);
      vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    });

    expect(setScreen).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("rejects transitions outside the screen policy", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.MENU, setScreen));

    expect(() => result.current.navigateTo(ROUTE_SCREENS.BATTLE)).toThrow(
      "Disallowed screen transition: menu -> battle",
    );
    expect(setScreen).not.toHaveBeenCalled();
  });

  it("uses the latest screen at fire time for same-screen commits", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ screen }: { screen: Screen }) => useScreenTransitions(screen, setScreen),
      {
        initialProps: { screen: ROUTE_SCREENS.MENU as Screen },
      },
    );

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.GAME_MODE_SELECT, onCommit);
    });
    rerender({ screen: ROUTE_SCREENS.GAME_MODE_SELECT });
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    });

    expect(setScreen).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("clears a pending navigateTo commit when a delayed transition starts", () => {
    const setScreen = vi.fn();
    const leftoverCommit = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.REWARDS, leftoverCommit);
      result.current.transition(ROUTE_SCREENS.GAME_OVER, { delayMs: 250 });
      vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    });

    expect(setScreen).not.toHaveBeenCalled();
    expect(leftoverCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_OVER);
    result.current.commitPendingTransition();
    expect(leftoverCommit).not.toHaveBeenCalled();
  });

  it("clears a pending navigateTo when an immediate transition starts", () => {
    const setScreen = vi.fn();
    const leftoverCommit = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.REWARDS, leftoverCommit);
      result.current.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true });
      vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    });

    expect(setScreen).toHaveBeenCalledOnce();
    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_OVER);
    expect(leftoverCommit).not.toHaveBeenCalled();
  });
});
