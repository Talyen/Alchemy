import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import { resetRunNavigationSlice } from "../../../helpers/run-domain-store-test";
import { ROUTE_SCREENS, type Screen, type ScreenTransitionOptions } from "@/lib/routing";

beforeEach(() => {
  vi.useFakeTimers();
  resetRunNavigationSlice();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useScreenTransitions.transition", () => {
  it.each([false, true])("checks the default guard at apply time (initially %s)", (initiallyAllowed) => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    let allowed = initiallyAllowed;
    const guard = vi.fn(() => allowed);
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.transition(ROUTE_SCREENS.REWARDS, { guard, onCommit });
    expect(guard).not.toHaveBeenCalled();
    result.current.commitPendingTransition();
    expect(onCommit).not.toHaveBeenCalled();

    allowed = false;
    vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    result.current.commitPendingTransition();

    expect(guard).toHaveBeenCalledOnce();
    expect(setScreen).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("defers an accepted default callback until the rendered swap without rechecking the guard", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    let allowed = true;
    const guard = vi.fn(() => allowed);
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.transition(ROUTE_SCREENS.REWARDS, { guard, onCommit });
    vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    expect(setScreen).toHaveBeenCalledExactlyOnceWith(ROUTE_SCREENS.REWARDS);
    expect(onCommit).not.toHaveBeenCalled();

    allowed = false;
    result.current.commitPendingTransition();
    result.current.commitPendingTransition();
    expect(guard).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("gives immediate navigation precedence over a supplied delay", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn(() => expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_OVER));
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true, delayMs: 250, onCommit });

    expect(onCommit).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("checks an immediate guard before applying either the screen or callback", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true, guard: () => false, onCommit });
    result.current.commitPendingTransition();

    expect(setScreen).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("runs an explicitly delayed callback after the screen update without waiting for a swap", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn(() => expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.REWARDS));
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.transition(ROUTE_SCREENS.REWARDS, { delayMs: 250, onCommit });
    vi.advanceTimersByTime(249);
    expect(onCommit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledOnce();
    result.current.commitPendingTransition();
    expect(onCommit).toHaveBeenCalledOnce();
  });

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

describe("useScreenTransitions cancellation", () => {
  it.each<ScreenTransitionOptions>([{}, { delayMs: 250 }])(
    "cancels scheduled navigation on unmount (%j)",
    (options) => {
      const setScreen = vi.fn();
      const onCommit = vi.fn();
      const { result, unmount } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

      result.current.transition(ROUTE_SCREENS.REWARDS, { ...options, onCommit });
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      vi.runAllTimers();
      result.current.commitPendingTransition();

      expect(setScreen).not.toHaveBeenCalled();
      expect(onCommit).not.toHaveBeenCalled();
    },
  );

  it("discards a callback awaiting the rendered swap on unmount", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.navigateTo(ROUTE_SCREENS.REWARDS, onCommit);
    vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    expect(setScreen).toHaveBeenCalledOnce();
    unmount();
    result.current.commitPendingTransition();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each([false, true])("explicit cancellation clears pending work (screen applied: %s)", (screenApplied) => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.navigateTo(ROUTE_SCREENS.REWARDS, onCommit);
    if (screenApplied) vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    result.current.cancelPending();
    vi.runAllTimers();
    result.current.commitPendingTransition();

    expect(setScreen).toHaveBeenCalledTimes(screenApplied ? 1 : 0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("replaces default navigation and its callback with the latest request", () => {
    const setScreen = vi.fn();
    const firstCommit = vi.fn();
    const lastCommit = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));

    result.current.navigateTo(ROUTE_SCREENS.REWARDS, firstCommit);
    result.current.navigateTo(ROUTE_SCREENS.GAME_OVER, lastCommit);
    vi.runAllTimers();
    result.current.commitPendingTransition();

    expect(setScreen).toHaveBeenCalledExactlyOnceWith(ROUTE_SCREENS.GAME_OVER);
    expect(firstCommit).not.toHaveBeenCalled();
    expect(lastCommit).toHaveBeenCalledOnce();
  });

  it("supports navigation after Strict Mode effect cleanup", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen), {
      reactStrictMode: true,
    });

    result.current.navigateTo(ROUTE_SCREENS.REWARDS, onCommit);
    vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    result.current.commitPendingTransition();
    expect(setScreen).toHaveBeenCalledExactlyOnceWith(ROUTE_SCREENS.REWARDS);
    expect(onCommit).toHaveBeenCalledOnce();

    result.current.navigateTo(ROUTE_SCREENS.GAME_OVER);
    unmount();
    vi.runAllTimers();
    expect(setScreen).toHaveBeenCalledOnce();
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

    expect(setScreen).toHaveBeenCalledExactlyOnceWith(ROUTE_SCREENS.GAME_OVER);
    expect(leftoverCommit).not.toHaveBeenCalled();
  });
});
