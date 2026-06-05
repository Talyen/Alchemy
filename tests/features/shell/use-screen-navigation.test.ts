// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useScreenNavigation } from "@/features/alchemy/shell/use-screen-navigation";
import { useNavigationStore } from "@/features/alchemy/shared/stores/navigation-store";

beforeEach(() => {
  vi.useFakeTimers();
  useNavigationStore.setState(useNavigationStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useScreenNavigation", () => {
  it("navigateTo updates screen after the navigation delay", () => {
    const setScreen = vi.fn();
    const { result } = renderHook(() => useScreenNavigation(ROUTE_SCREENS.MENU, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.SHOP);
      vi.advanceTimersByTime(100);
    });

    expect(setScreen).toHaveBeenCalledWith(ROUTE_SCREENS.SHOP);
  });

  it("commitPendingTransition runs deferred screen commit callbacks", () => {
    const setScreen = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useScreenNavigation(ROUTE_SCREENS.MENU, setScreen));

    act(() => {
      result.current.navigateTo(ROUTE_SCREENS.MENU, onCommit);
      vi.advanceTimersByTime(100);
    });

    expect(setScreen).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
