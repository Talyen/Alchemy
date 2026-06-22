// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import { resetRunNavigationSlice } from "../../../helpers/run-domain-store-test";

beforeEach(() => {
  vi.useFakeTimers();
  resetRunNavigationSlice();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useScreenTransitions", () => {
  it("navigateTo updates screen after the navigation delay", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.MENU, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.SHOP);
      vi.advanceTimersByTime(100);
    });

    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.SHOP);
  });

  it("commitPendingTransition runs deferred screen commit callbacks", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.MENU, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.MENU, onCommit);
      vi.advanceTimersByTime(100);
    });

    expect(setScreen).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
